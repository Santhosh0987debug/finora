import { Router, type Request, type Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";

const router = Router();

// Categories are global reference data. Authentication is still required so
// the UI uses the same authenticated API path as every other finance request.
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (_req: Request, res: Response): Promise<Response> => {
    const categories = await prisma.category.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    });

    return res.status(200).json({ categories });
  }),
);

export default router;
