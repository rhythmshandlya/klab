ALTER TABLE "sandboxes" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sandboxes" ADD COLUMN "starred" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sandboxes" ADD COLUMN "visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "sandboxes" ADD COLUMN "active_file_path" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sandboxes" ADD COLUMN "last_opened_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "sandboxes_user_last_opened_idx" ON "sandboxes" USING btree ("user_id","last_opened_at");--> statement-breakpoint
CREATE INDEX "sandboxes_user_starred_idx" ON "sandboxes" USING btree ("user_id","starred","updated_at");