BEGIN;

ALTER TABLE "candidate_transactions"
DROP CONSTRAINT "candidate_transactions_saved_transaction_id_fkey";

ALTER TABLE "candidate_transactions"
ADD CONSTRAINT "candidate_transactions_saved_transaction_id_fkey"
FOREIGN KEY ("saved_transaction_id") REFERENCES "transactions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
