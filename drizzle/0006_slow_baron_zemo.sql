CREATE TABLE "community_discussion_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discussion_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"client_id" text NOT NULL,
	"parent_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_discussions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text NOT NULL,
	"client_id" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_official" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "community_discussion_replies" ADD CONSTRAINT "community_discussion_replies_discussion_id_community_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."community_discussions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_discussion_replies" ADD CONSTRAINT "community_discussion_replies_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_discussions" ADD CONSTRAINT "community_discussions_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_replies_author_client_key" ON "community_discussion_replies" USING btree ("author_id","client_id");--> statement-breakpoint
CREATE INDEX "community_replies_discussion_created_idx" ON "community_discussion_replies" USING btree ("discussion_id","created_at");--> statement-breakpoint
CREATE INDEX "community_replies_parent_created_idx" ON "community_discussion_replies" USING btree ("parent_id","created_at");--> statement-breakpoint
CREATE INDEX "community_replies_author_idx" ON "community_discussion_replies" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "community_discussions_author_client_key" ON "community_discussions" USING btree ("author_id","client_id");--> statement-breakpoint
CREATE INDEX "community_discussions_activity_idx" ON "community_discussions" USING btree ("pinned","last_activity_at");--> statement-breakpoint
CREATE INDEX "community_discussions_category_activity_idx" ON "community_discussions" USING btree ("category","last_activity_at");--> statement-breakpoint
CREATE INDEX "community_discussions_status_activity_idx" ON "community_discussions" USING btree ("status","last_activity_at");--> statement-breakpoint
CREATE INDEX "community_discussions_author_idx" ON "community_discussions" USING btree ("author_id","created_at");