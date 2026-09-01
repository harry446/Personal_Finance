/*
  Warnings:

  - Made the column `model` on table `extraction_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `duration_ms` on table `extraction_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `model` on table `import_batches` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "extraction_logs" ALTER COLUMN "model" SET NOT NULL,
ALTER COLUMN "duration_ms" SET NOT NULL;

-- AlterTable
ALTER TABLE "import_batches" ALTER COLUMN "model" SET NOT NULL;
