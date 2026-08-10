DROP INDEX "submissions_client_mutation_id_key";--> statement-breakpoint
UPDATE "submissions" SET "client_mutation_id" = "id"::text WHERE "client_mutation_id" IS NULL;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "client_mutation_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_user_client_mutation_id_key" ON "submissions" USING btree ("user_id","client_mutation_id");
