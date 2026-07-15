CREATE TYPE "public"."role" AS ENUM('creator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."section_key" AS ENUM('cjs_program_costs', 'rjc_program_costs', 'hp_rp_community_inputs');--> statement-breakpoint
CREATE TABLE "roi_case_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"section_key" "section_key" NOT NULL,
	"field_key" text NOT NULL,
	"default_value" numeric NOT NULL,
	"current_value" numeric NOT NULL,
	"note" text,
	"annotation" text,
	CONSTRAINT "roi_case_fields_case_field_key" UNIQUE("case_id","field_key")
);
--> statement-breakpoint
CREATE TABLE "roi_case_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"published_by" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roi_case_versions_case_version" UNIQUE("case_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "roi_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"is_private" boolean DEFAULT true NOT NULL,
	"share_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roi_cases_share_slug_unique" UNIQUE("share_slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'creator' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "roi_case_fields" ADD CONSTRAINT "roi_case_fields_case_id_roi_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."roi_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_case_versions" ADD CONSTRAINT "roi_case_versions_case_id_roi_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."roi_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_case_versions" ADD CONSTRAINT "roi_case_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_cases" ADD CONSTRAINT "roi_cases_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roi_case_fields_case_id_idx" ON "roi_case_fields" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "roi_case_versions_case_id_idx" ON "roi_case_versions" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "roi_cases_owner_id_idx" ON "roi_cases" USING btree ("owner_id");