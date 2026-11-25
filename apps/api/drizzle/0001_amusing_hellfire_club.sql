CREATE TABLE "recipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"copy_owner_id" text NOT NULL,
	"title" text NOT NULL,
	"language" text NOT NULL,
	"servings" text,
	"time" text,
	"ingredients" jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"source" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_copy_owner_id_user_id_fk" FOREIGN KEY ("copy_owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_copy_owner_id_updated_at_idx" ON "recipe" USING btree ("copy_owner_id","updated_at" DESC NULLS LAST);