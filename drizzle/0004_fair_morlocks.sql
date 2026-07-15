CREATE TABLE "field_explanations" (
	"variable_key" text PRIMARY KEY NOT NULL,
	"explanation" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "field_explanations" ADD CONSTRAINT "field_explanations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;