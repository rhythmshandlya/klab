CREATE TABLE "progress_completed_lessons" (
	"user_id" text NOT NULL,
	"lesson_slug" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "progress_completed_lessons_user_id_lesson_slug_pk" PRIMARY KEY("user_id","lesson_slug")
);
--> statement-breakpoint
ALTER TABLE "progress_completed_lessons" ADD CONSTRAINT "progress_completed_lessons_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;