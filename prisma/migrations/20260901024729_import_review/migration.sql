-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('processing', 'ready_for_review', 'approved', 'failed');

-- CreateEnum
CREATE TYPE "CandidateReviewState" AS ENUM ('pending', 'selected', 'excluded', 'approved');

-- CreateEnum
CREATE TYPE "ExtractionLogStatus" AS ENUM ('pending', 'succeeded', 'failed');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "import_batch_id" TEXT;

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'ready_for_review',
    "file_count" INTEGER NOT NULL DEFAULT 0,
    "candidate_count" INTEGER NOT NULL DEFAULT 0,
    "approved_count" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "failure_code" TEXT,
    "failure_message_safe" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_transactions" (
    "id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "transaction_date" DATE,
    "type" "TransactionType",
    "amount_cents" INTEGER,
    "description" TEXT,
    "category_id" TEXT,
    "notes" TEXT,
    "suggested_category_text" TEXT,
    "review_state" "CandidateReviewState" NOT NULL DEFAULT 'pending',
    "saved_transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_logs" (
    "id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "provider_request_id" TEXT,
    "model" TEXT,
    "status" "ExtractionLogStatus" NOT NULL DEFAULT 'pending',
    "raw_output_ciphertext" TEXT,
    "error_code" TEXT,
    "duration_ms" INTEGER,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extraction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_batches_user_id_created_at_idx" ON "import_batches"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_transactions_saved_transaction_id_key" ON "candidate_transactions"("saved_transaction_id");

-- CreateIndex
CREATE INDEX "candidate_transactions_import_batch_id_review_state_idx" ON "candidate_transactions"("import_batch_id", "review_state");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_transactions_import_batch_id_ordinal_key" ON "candidate_transactions"("import_batch_id", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "extraction_logs_import_batch_id_key" ON "extraction_logs"("import_batch_id");

-- CreateIndex
CREATE INDEX "extraction_logs_expires_at_idx" ON "extraction_logs"("expires_at");

-- CreateIndex
CREATE INDEX "transactions_import_batch_id_idx" ON "transactions"("import_batch_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_transactions" ADD CONSTRAINT "candidate_transactions_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_transactions" ADD CONSTRAINT "candidate_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_transactions" ADD CONSTRAINT "candidate_transactions_saved_transaction_id_fkey" FOREIGN KEY ("saved_transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_logs" ADD CONSTRAINT "extraction_logs_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
