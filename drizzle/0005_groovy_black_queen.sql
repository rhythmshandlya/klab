ALTER TABLE "sandboxes" ADD COLUMN "published_from_id" uuid;--> statement-breakpoint
ALTER TABLE "sandboxes" ADD COLUMN "forked_from_id" uuid;--> statement-breakpoint
ALTER TABLE "sandboxes" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "sandboxes" ADD COLUMN "fork_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sandboxes_user_published_from_key" ON "sandboxes" USING btree ("user_id","published_from_id");--> statement-breakpoint
CREATE INDEX "sandboxes_public_published_idx" ON "sandboxes" USING btree ("visibility","published_at");--> statement-breakpoint
CREATE INDEX "sandboxes_forked_from_idx" ON "sandboxes" USING btree ("forked_from_id");