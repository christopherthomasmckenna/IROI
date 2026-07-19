ALTER TABLE "field_explanations" ALTER COLUMN "explanation" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "field_explanations" ADD COLUMN "short_hint" text;--> statement-breakpoint
ALTER TABLE "field_explanations" ADD COLUMN "how_to_localize" text;--> statement-breakpoint
ALTER TABLE "field_explanations" ADD COLUMN "provenance" text;