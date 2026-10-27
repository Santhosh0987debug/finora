export type AccountType = "CHECKING" | "SAVINGS" | "CREDIT_CARD";
export type CategoryType = "INCOME" | "EXPENSE";
export type TransactionType = CategoryType | "TRANSFER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
}

export interface TransactionRecord {
  id: string;
  accountId: string;
  categoryId: string | null;
  amount: string;
  type: TransactionType;
  description: string | null;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
}

export type BudgetStatus = "UNDER" | "APPROACHING" | "OVER";

export interface BudgetRecord {
  id: string;
  categoryId: string;
  amount: string;
  month: number;
  year: number;
  category: Category;
  spent: string;
  remaining: string;
  percentage: number;
  status: BudgetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetPeriod {
  month: number;
  year: number;
}

export interface BudgetListResponse {
  period: BudgetPeriod;
  budgets: BudgetRecord[];
}

export interface BudgetMutationInput {
  categoryId: string;
  amount: string;
  month: number;
  year: number;
}

export interface PotRecord {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string | null;
  remaining: string;
  percentage: number;
  isComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PotMutationInput {
  name: string;
  targetAmount: string;
  currentAmount?: string;
  targetDate: string | null;
}

export interface PotMovementInput {
  amount: string;
}

export interface DashboardPotSummary {
  count: number;
  totalSaved: string;
  totalTarget: string;
  totalRemaining: string;
  completedCount: number;
  percentage: number;
}

export type BillFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
export type BillStatus = "UPCOMING" | "PAID" | "OVERDUE";

export interface BillRecord {
  id: string;
  name: string;
  amount: string;
  frequency: BillFrequency;
  dueDate: string;
  status: BillStatus;
  daysUntilDue: number;
  createdAt: string;
  updatedAt: string;
}

export interface BillMutationInput {
  name: string;
  amount: string;
  frequency: BillFrequency;
  dueDate: string;
  status?: "UPCOMING" | "PAID";
}

export type BillEditableStatus = "UPCOMING" | "PAID";

export interface DashboardBillSummary {
  count: number;
  overdueCount: number;
  upcomingCount: number;
  paidCount: number;
  totalDue: string;
  overdueAmount: string;
  nextDue: {
    id: string;
    name: string;
    amount: string;
    dueDate: string;
    status: BillStatus;
  } | null;
}

export interface TransactionPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface TransactionListResponse {
  transactions: TransactionRecord[];
  pagination: TransactionPagination;
}

export type TransactionMutationType = Extract<
  TransactionType,
  "INCOME" | "EXPENSE"
>;

export interface TransactionMutationInput {
  accountId: string;
  categoryId: string | null;
  amount: string;
  type: TransactionMutationType;
  description: string | null;
  transactionDate: string;
}

export interface SummaryAccount {
  id: string;
  name: string;
  type: AccountType;
}

export interface SummaryCategory {
  id: string;
  name: string;
  type: CategoryType;
}

export interface MonthlyOverviewPoint {
  month: string;
  income: string;
  expenses: string;
}

export interface ExpenseBreakdownItem {
  categoryId: string | null;
  categoryName: string;
  amount: string;
  percentage: number;
}

export interface RecentTransaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  amount: string;
  type: TransactionType;
  description: string | null;
  transactionDate: string;
  account: SummaryAccount;
  category: SummaryCategory | null;
}

export interface DashboardBudgetSummary {
  month: string;
  totalLimit: string;
  totalSpent: string;
  totalRemaining: string;
  count: number;
  underCount: number;
  approachingCount: number;
  overCount: number;
}

export interface DashboardSummary {
  totalBalance: string;
  totalIncome: string;
  totalExpenses: string;
  budgetSummary: DashboardBudgetSummary;
  potSummary: DashboardPotSummary;
  billSummary: DashboardBillSummary;
  monthlyOverview: MonthlyOverviewPoint[];
  expenseBreakdown: ExpenseBreakdownItem[];
  recentTransactions: RecentTransaction[];
}
