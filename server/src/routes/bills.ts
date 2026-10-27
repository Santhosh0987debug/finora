import { Router, type Request, type Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { loadBills, toBillDto } from "../lib/bills";
import {
  createBillSchema,
  updateBillSchema,
  updateBillStatusSchema,
} from "../schemas/bills";

const router = Router();

// Recurring bills are always scoped to the authenticated JWT user.
router.use(requireAuth);

function validationError(
  res: Response,
  issues: { message: string }[],
): Response {
  return res
    .status(400)
    .json({ error: issues[0]?.message ?? "Invalid request" });
}

async function findOwnedBill(id: string, userId: string) {
  return prisma.recurringBill.findFirst({ where: { id, userId } });
}

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const bills = await loadBills(req.userId ?? "");
    return res
      .status(200)
      .json({ bills: bills.map((bill) => toBillDto(bill)) });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const bill = await findOwnedBill(req.params.id, req.userId ?? "");
    if (!bill) {
      return res.status(404).json({ error: "Recurring bill not found" });
    }
    return res.status(200).json({ bill: toBillDto(bill) });
  }),
);

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const parsed = createBillSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, parsed.error.issues);
    }

    const bill = await prisma.recurringBill.create({
      data: {
        userId: req.userId ?? "",
        name: parsed.data.name,
        amount: parsed.data.amount,
        frequency: parsed.data.frequency,
        dueDate: parsed.data.dueDate,
        ...(parsed.data.status !== undefined
          ? { status: parsed.data.status }
          : {}),
      },
    });
    return res.status(201).json({ bill: toBillDto(bill) });
  }),
);

router.patch(
  "/:id/status",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const parsed = updateBillStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, parsed.error.issues);
    }

    const existing = await findOwnedBill(
      req.params.id,
      req.userId ?? "",
    );
    if (!existing) {
      return res.status(404).json({ error: "Recurring bill not found" });
    }

    const bill = await prisma.recurringBill.update({
      where: { id: existing.id },
      data: { status: parsed.data.status },
    });
    return res.status(200).json({ bill: toBillDto(bill) });
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const parsed = updateBillSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, parsed.error.issues);
    }

    const existing = await findOwnedBill(
      req.params.id,
      req.userId ?? "",
    );
    if (!existing) {
      return res.status(404).json({ error: "Recurring bill not found" });
    }

    const bill = await prisma.recurringBill.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.name !== undefined
          ? { name: parsed.data.name }
          : {}),
        ...(parsed.data.amount !== undefined
          ? { amount: parsed.data.amount }
          : {}),
        ...(parsed.data.frequency !== undefined
          ? { frequency: parsed.data.frequency }
          : {}),
        ...(parsed.data.dueDate !== undefined
          ? { dueDate: parsed.data.dueDate }
          : {}),
        ...(parsed.data.status !== undefined
          ? { status: parsed.data.status }
          : {}),
      },
    });
    return res.status(200).json({ bill: toBillDto(bill) });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const existing = await findOwnedBill(
      req.params.id,
      req.userId ?? "",
    );
    if (!existing) {
      return res.status(404).json({ error: "Recurring bill not found" });
    }

    await prisma.recurringBill.delete({ where: { id: existing.id } });
    return res.status(204).send();
  }),
);

export default router;
