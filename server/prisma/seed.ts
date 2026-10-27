import { prisma } from "../src/lib/prisma.js";

// Default transaction categories. Safe to rerun: each entry is upserted by
// its unique name, so no duplicates are created. Seeds categories only —
// never fake financial transactions.

const DEFAULT_CATEGORIES = [
  { name: "Salary", type: "INCOME" },
  { name: "Freelance", type: "INCOME" },
  { name: "Investments", type: "INCOME" },
  { name: "Other Income", type: "INCOME" },
  { name: "Groceries", type: "EXPENSE" },
  { name: "Dining Out", type: "EXPENSE" },
  { name: "Housing", type: "EXPENSE" },
  { name: "Transportation", type: "EXPENSE" },
  { name: "Utilities", type: "EXPENSE" },
  { name: "Healthcare", type: "EXPENSE" },
  { name: "Entertainment", type: "EXPENSE" },
  { name: "Shopping", type: "EXPENSE" },
  { name: "Education", type: "EXPENSE" },
  { name: "Travel", type: "EXPENSE" },
  { name: "Personal Care", type: "EXPENSE" },
  { name: "Savings", type: "EXPENSE" },
  { name: "Other Expense", type: "EXPENSE" },
] as const;

async function main() {
  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: { type: category.type },
      create: { name: category.name, type: category.type },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${DEFAULT_CATEGORIES.length} default categories.`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
