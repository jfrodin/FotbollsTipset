ALTER TABLE "predictions" ADD COLUMN "analysis" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_bot" boolean DEFAULT false NOT NULL;