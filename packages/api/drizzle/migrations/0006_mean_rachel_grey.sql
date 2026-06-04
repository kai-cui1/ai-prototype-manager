CREATE TABLE "domain_boundaries" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"config" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "domain_entities" ADD COLUMN "domain_id" text;--> statement-breakpoint
ALTER TABLE "domain_boundaries" ADD CONSTRAINT "domain_boundaries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_domain_boundaries_project" ON "domain_boundaries" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "domain_boundaries_project_name_unique" ON "domain_boundaries" USING btree ("project_id","name");--> statement-breakpoint
ALTER TABLE "domain_entities" ADD CONSTRAINT "domain_entities_domain_id_domain_boundaries_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domain_boundaries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_domain_entities_domain" ON "domain_entities" USING btree ("domain_id");