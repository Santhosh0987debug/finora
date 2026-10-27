import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { toPotDto } from "../lib/pots";
import {
  createPotSchema,
  potMovementSchema,
  updatePotSchema,
} from "../schemas/pots";

const router = Router();

// Savings pots are always scoped to the authenticated JWT user.
router.use(requireAuth);

function validationError(
  res: Response,
  issues: { message: string }[],
): Response {
  return res
    .status(400)
    .json({ error: issues[0]?.message ?? "Invalid request" });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function duplicateNameResponse(res: Response): Response {
  return res
    .status(409)
    .json({ error: "A savings pot with this name already exists" });
}

async function findOwnedPot(id: string, userId: string) {
  return prisma.pot.findFirst({ where: { id, userId } });
}

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const pots = await prisma.pot.findMany({
      where: { userId: req.userId ?? "" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return res.status(200).json({ pots: pots.map(toPotDto) });
  }),
);

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const parsed = createPotSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, parsed.error.issues);
    }

    const targetAmount = new Prisma.Decimal(parsed.data.targetAmount);
    const currentAmount = new Prisma.Decimal(
      parsed.data.currentAmount ?? 0,
    );
    if (currentAmount.greaterThan(targetAmount)) {
      return res
        .status(400)
        .json({ error: "Current amount cannot exceed the target amount" });
    }

    try {
      const pot = await prisma.pot.create({
        data: {
          userId: req.userId ?? "",
          name: parsed.data.name,
          targetAmount,
          currentAmount,
          ...(parsed.data.targetDate !== undefined
            ? { targetDate: parsed.data.targetDate }
            : {}),
        },
      });
      return res.status(201).json({ pot: toPotDto(pot) });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return duplicateNameResponse(res);
      }
      throw error;
    }
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const pot = await findOwnedPot(req.params.id, req.userId ?? "");
    if (!pot) {
      return res.status(404).json({ error: "Savings pot not found" });
    }
    return res.status(200).json({ pot: toPotDto(pot) });
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const parsed = updatePotSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, parsed.error.issues);
    }

    const existing = await findOwnedPot(
      req.params.id,
      req.userId ?? "",
    );
    if (!existing) {
      return res.status(404).json({ error: "Savings pot not found" });
    }

    const targetAmount =
      parsed.data.targetAmount !== undefined
        ? new Prisma.Decimal(parsed.data.targetAmount)
        : existing.targetAmount;
    const currentAmount =
      parsed.data.currentAmount !== undefined
        ? new Prisma.Decimal(parsed.data.currentAmount)
        : existing.currentAmount;
    if (currentAmount.greaterThan(targetAmount)) {
      return res
        .status(400)
        .json({ error: "Current amount cannot exceed the target amount" });
    }

    try {
      const pot = await prisma.pot.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.name !== undefined
            ? { name: parsed.data.name }
            : {}),
          ...(parsed.data.targetAmount !== undefined
            ? { targetAmount }
            : {}),
          ...(parsed.data.currentAmount !== undefined
            ? { currentAmount }
            : {}),
          ...(parsed.data.targetDate !== undefined
            ? { targetDate: parsed.data.targetDate }
            : {}),
        },
      });
      return res.status(200).json({ pot: toPotDto(pot) });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return duplicateNameResponse(res);
      }
      throw error;
    }
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const existing = await findOwnedPot(
      req.params.id,
      req.userId ?? "",
    );
    if (!existing) {
      return res.status(404).json({ error: "Savings pot not found" });
    }

    await prisma.pot.delete({ where: { id: existing.id } });
    return res.status(204).send();
  }),
);

async function movePotMoney(
  req: Request,
  res: Response,
  direction: "deposit" | "withdraw",
): Promise<Response> {
  const parsed = potMovementSchema.safeParse(req.body);
  if (!parsed.success) {
    return validationError(res, parsed.error.issues);
  }

  const existing = await findOwnedPot(req.params.id, req.userId ?? "");
  if (!existing) {
    return res.status(404).json({ error: "Savings pot not found" });
  }

  const amount = new Prisma.Decimal(parsed.data.amount);
  const nextAmount =
    direction === "deposit"
      ? existing.currentAmount.add(amount)
      : existing.currentAmount.sub(amount);

  if (nextAmount.lessThan(0)) {
    return res
      .status(400)
      .json({ error: "Withdrawal cannot exceed the current saved amount" });
  }
  if (nextAmount.greaterThan(existing.targetAmount)) {
    return res
      .status(400)
      .json({ error: "Deposit cannot exceed the amount remaining" });
  }

  // Compare-and-set protects against concurrent deposits/withdrawals or edits
  // replacing the balance with a stale value.
  const result = await prisma.pot.updateMany({
    where: {
      id: existing.id,
      userId: req.userId ?? "",
      currentAmount: existing.currentAmount,
      targetAmount: existing.targetAmount,
    },
    data: { currentAmount: nextAmount },
  });
  if (result.count !== 1) {
    return res.status(409).json({
      error: "This savings pot changed. Refresh and try again.",
    });
  }

  const pot = await prisma.pot.findUnique({ where: { id: existing.id } });
  if (!pot) {
    return res.status(404).json({ error: "Savings pot not found" });
  }
  return res.status(200).json({ pot: toPotDto(pot) });
}

router.post(
  "/:id/deposit",
  asyncHandler(
    async (req: Request, res: Response): Promise<Response> =>
      movePotMoney(req, res, "deposit"),
  ),
);

router.post(
  "/:id/withdraw",
  asyncHandler(
    async (req: Request, res: Response): Promise<Response> =>
      movePotMoney(req, res, "withdraw"),
  ),
);

export default router;
