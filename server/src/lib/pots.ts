import { Prisma, type Pot } from "@prisma/client";
import { prisma } from "./prisma";

export type PotSummary = {
  count: number;
  totalSaved: string;
  totalTarget: string;
  totalRemaining: string;
  completedCount: number;
  percentage: number;
};

function progressPercentage(
  target: Prisma.Decimal,
  current: Prisma.Decimal,
): number {
  if (target.lessThanOrEqualTo(0)) {
    return 0;
  }
  return Number(
    current.div(target).mul(100).toDecimalPlaces(2).toString(),
  );
}

function remainingAmount(
  target: Prisma.Decimal,
  current: Prisma.Decimal,
): Prisma.Decimal {
  const remaining = target.sub(current);
  return remaining.lessThan(0) ? new Prisma.Decimal(0) : remaining;
}

export function toPotDto(pot: Pot) {
  return {
    id: pot.id,
    name: pot.name,
    targetAmount: pot.targetAmount.toFixed(2),
    currentAmount: pot.currentAmount.toFixed(2),
    targetDate: pot.targetDate
      ? pot.targetDate.toISOString().slice(0, 10)
      : null,
    remaining: remainingAmount(pot.targetAmount, pot.currentAmount).toFixed(2),
    percentage: progressPercentage(pot.targetAmount, pot.currentAmount),
    isComplete: pot.currentAmount.greaterThanOrEqualTo(pot.targetAmount),
    createdAt: pot.createdAt,
    updatedAt: pot.updatedAt,
  };
}

export function summarizePots(
  pots: Array<Pick<Pot, "targetAmount" | "currentAmount">>,
): PotSummary {
  let totalSaved = new Prisma.Decimal(0);
  let totalTarget = new Prisma.Decimal(0);
  let completedCount = 0;

  for (const pot of pots) {
    totalSaved = totalSaved.add(pot.currentAmount);
    totalTarget = totalTarget.add(pot.targetAmount);
    if (pot.currentAmount.greaterThanOrEqualTo(pot.targetAmount)) {
      completedCount += 1;
    }
  }

  return {
    count: pots.length,
    totalSaved: totalSaved.toFixed(2),
    totalTarget: totalTarget.toFixed(2),
    totalRemaining: remainingAmount(totalTarget, totalSaved).toFixed(2),
    completedCount,
    percentage: progressPercentage(totalTarget, totalSaved),
  };
}

export async function loadPotSummary(userId: string): Promise<PotSummary> {
  const pots = await prisma.pot.findMany({
    where: { userId },
    select: { targetAmount: true, currentAmount: true },
  });
  return summarizePots(pots);
}
