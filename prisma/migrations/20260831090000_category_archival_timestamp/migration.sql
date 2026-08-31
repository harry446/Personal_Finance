ALTER TABLE "categories" ADD COLUMN "archived_at" TIMESTAMP(3);

UPDATE "categories"
SET "archived_at" = CURRENT_TIMESTAMP
WHERE NOT "is_active";

DROP INDEX "categories_user_id_is_active_idx";

ALTER TABLE "categories" DROP COLUMN "is_active";

CREATE INDEX "categories_user_id_archived_at_idx"
ON "categories"("user_id", "archived_at");
