import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import {
  loadBudgetsForPeriod,
  spendingForBudget,
  toBudgetDto,
  type BudgetWithCategory,
} from "../lib/budgets";
import {
  createBudgetSchema,
  listBudgetsQuerySchema,
  updateBudgetSchema,
} from "../schemas/budgets";

const router = Router();

// Budgets are always scoped to the authenticated JWT user.
router.use(requireAuth);

function validationError(res: Response, issues: { message: string }[]): Response {
  return res
    .status(400)
    .json({ error: issues[0]?.message ?? "Invalid request" });
}

async function findOwnedBudget(
  id: string,
  userId: string,
): Promise<BudgetWithCategory | null> {
  return prisma.budget.findFirst({
    where: { id, userId },
    include: { category: true },
  });
}

// Only expense categories can have budgets. Category rows are global
// reference data, so existence/type is checked while ownership stays on the
// budget itself.
async function categoryValidationError(
  categoryId: string,
): Promise<string | null> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { type: true },
  });
  if (!category) {
    return "Category not found";
  }
  if (category.type !== "EXPENSE") {
    return "Budgets can only use expense categories";
  }
  return null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function duplicateBudgetResponse(res: Response): Response {
  return res.status(409).json({
    error: "A budget already exists for this category and month",
  });
}

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const parsed = listBudgetsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return validationError(res, parsed.error.issues);
    }

    const now = new Date();
    const month = parsed.data.month ?? now.getUTCMonth() + 1;
    const year = parsed.data.year ?? now.getUTCFullYear();
    const budgets = await loadBudgetsForPeriod(
      req.userId ?? "",
      month,
      year,
    );

    return res.status(200).json({
      period: { month, year },
      budgets: budgets.map(toBudgetDto),
    });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const budget = await findOwnedBudget(
      req.params.id,
      req.userId ?? "",
    );
    if (!budget) {
      return res.status(404).json({ error: "Budget not found" });
    }

    const spent = await spendingForBudget(req.userId ?? "", budget);
    return res.status(200).json({
      budget: toBudgetDto({ budget, spent }),
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const parsed = createBudgetSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, parsed.error.issues);
    }

    const categoryError = await categoryValidationError(
      parsed.data.categoryId,
    );
    if (categoryError) {
      return res.status(400).json({ error: categoryError });
    }

    try {
      const budget = await prisma.budget.create({
        data: {
          userId: req.userId ?? "",
          categoryId: parsed.data.categoryId,
          amount: parsed.data.amount,
          month: parsed.data.month,
          year: parsed.data.year,
        },
        include: { category: true },
      });
      const spent = await spendingForBudget(req.userId ?? "", budget);
      return res.status(201).json({
        budget: toBudgetDto({ budget, spent }),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return duplicateBudgetResponse(res);
      }
      throw error;
    }
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const parsed = updateBudgetSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, parsed.error.issues);
    }

    const existing = await findOwnedBudget(
      req.params.id,
      req.userId ?? "",
    );
    if (!existing) {
      return res.status(404).json({ error: "Budget not found" });
    }

    if (parsed.data.categoryId !== undefined) {
      const categoryError = await categoryValidationError(
        parsed.data.categoryId,
      );
      if (categoryError) {
        return res.status(400).json({ error: categoryError });
      }
    }

    try {
      const budget = await prisma.budget.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.categoryId !== undefined
            ? { categoryId: parsed.data.categoryId }
            : {}),
          ...(parsed.data.amount !== undefined
            ? { amount: parsed.data.amount }
            : {}),
          ...(parsed.data.month !== undefined
            ? { month: parsed.data.month }
            : {}),
          ...(parsed.data.year !== undefined
            ? { year: parsed.data.year }
            : {}),
        },
        include: { category: true },
      });
      const spent = await spendingForBudget(req.userId ?? "", budget);
      return res.status(200).json({
        budget: toBudgetDto({ budget, spent }),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return duplicateBudgetResponse(res);
      }
      throw error;
    }
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const existing = await findOwnedBudget(
      req.params.id,
      req.userId ?? "",
    );
    if (!existing) {
      return res.status(404).json({ error: "Budget not found" });
    }

    await prisma.budget.delete({ where: { id: existing.id } });
    return res.status(204).send();
  }),
);

export default router;
