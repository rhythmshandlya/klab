CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"user_id" text NOT NULL,
	"level_slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_user_id_level_slug_pk" PRIMARY KEY("user_id","level_slug")
);
--> statement-breakpoint
CREATE TABLE "hint_reveals" (
	"user_id" text NOT NULL,
	"level_slug" text NOT NULL,
	"hint_id" text NOT NULL,
	"penalty" integer NOT NULL,
	"revealed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hint_reveals_user_id_level_slug_hint_id_pk" PRIMARY KEY("user_id","level_slug","hint_id")
);
--> statement-breakpoint
CREATE TABLE "merge_log" (
	"user_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "merge_log_user_id_fingerprint_pk" PRIMARY KEY("user_id","fingerprint")
);
--> statement-breakpoint
CREATE TABLE "progress_attempted" (
	"user_id" text NOT NULL,
	"level_slug" text NOT NULL,
	"first_attempt_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "progress_attempted_user_id_level_slug_pk" PRIMARY KEY("user_id","level_slug")
);
--> statement-breakpoint
CREATE TABLE "progress_solved" (
	"user_id" text NOT NULL,
	"level_slug" text NOT NULL,
	"awarded_xp" integer NOT NULL,
	"solved_day" text NOT NULL,
	"solved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "progress_solved_user_id_level_slug_pk" PRIMARY KEY("user_id","level_slug")
);
--> statement-breakpoint
CREATE TABLE "sandboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"template_id" text NOT NULL,
	"files" jsonb NOT NULL,
	"saved_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"level_slug" text NOT NULL,
	"passed" boolean NOT NULL,
	"checks_total" integer NOT NULL,
	"checks_passed" integer NOT NULL,
	"duration_ms" integer,
	"hints_revealed" integer,
	"results" jsonb,
	"client_mutation_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"is_anonymous" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hint_reveals" ADD CONSTRAINT "hint_reveals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_log" ADD CONSTRAINT "merge_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_attempted" ADD CONSTRAINT "progress_attempted_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_solved" ADD CONSTRAINT "progress_solved_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandboxes" ADD CONSTRAINT "sandboxes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sandboxes_user_name_key" ON "sandboxes" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_client_mutation_id_key" ON "submissions" USING btree ("client_mutation_id");--> statement-breakpoint
CREATE INDEX "submissions_level_passed_idx" ON "submissions" USING btree ("level_slug","passed");--> statement-breakpoint
CREATE INDEX "submissions_level_created_idx" ON "submissions" USING btree ("level_slug","created_at");--> statement-breakpoint
CREATE INDEX "submissions_user_level_idx" ON "submissions" USING btree ("user_id","level_slug");