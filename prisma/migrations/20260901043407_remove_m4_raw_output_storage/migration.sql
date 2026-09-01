/*
  Warnings:

  - You are about to drop the column `raw_output_ciphertext` on the `extraction_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "extraction_logs" DROP COLUMN "raw_output_ciphertext";
