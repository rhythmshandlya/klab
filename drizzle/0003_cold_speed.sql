DROP INDEX "sandboxes_user_name_key";--> statement-breakpoint
ALTER TABLE "sandboxes" ADD COLUMN "client_id" text;--> statement-breakpoint
UPDATE "sandboxes" SET "client_id" = "id"::text WHERE "client_id" IS NULL;--> statement-breakpoint
ALTER TABLE "sandboxes" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "public_profile" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sandboxes_user_client_id_key" ON "sandboxes" USING btree ("user_id","client_id");--> statement-breakpoint
CREATE INDEX "sandboxes_user_updated_idx" ON "sandboxes" USING btree ("user_id","updated_at");--> statement-breakpoint
-- Existing OAuth credentials were written before token encryption was enabled. The app
-- never calls GitHub APIs, so discard them and let the next sign-in store an encrypted copy.
UPDATE "account" SET "access_token" = NULL, "refresh_token" = NULL, "id_token" = NULL;
