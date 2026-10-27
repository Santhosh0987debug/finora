-- Add an optional target date to savings pots. Nullable, so existing rows are
-- preserved and no data rewrite is required.
ALTER TABLE "Pot" ADD COLUMN "targetDate" DATE;
