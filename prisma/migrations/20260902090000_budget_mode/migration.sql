-- AlterTable
ALTER TABLE "users" ADD COLUMN "budget_mode_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "BudgetMode" AS ENUM ('monthly_reset', 'rollover');

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_configurations" (
    "id" TEXT NOT NULL,
    "budget_id" TEXT NOT NULL,
    "effective_month" DATE NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "mode" "BudgetMode" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_configurations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "budget_configurations_amount_cents_positive" CHECK ("amount_cents" > 0),
    CONSTRAINT "budget_configurations_effective_month_first_day" CHECK (EXTRACT(DAY FROM "effective_month") = 1)
);

-- CreateIndex
CREATE UNIQUE INDEX "budgets_user_id_category_id_key" ON "budgets"("user_id", "category_id");

-- CreateIndex
CREATE INDEX "budgets_user_id_idx" ON "budgets"("user_id");

-- CreateIndex
CREATE INDEX "budgets_category_id_idx" ON "budgets"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_configurations_budget_id_effective_month_key" ON "budget_configurations"("budget_id", "effective_month");

-- CreateIndex
CREATE INDEX "budget_configurations_effective_month_idx" ON "budget_configurations"("effective_month");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_configurations" ADD CONSTRAINT "budget_configurations_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
