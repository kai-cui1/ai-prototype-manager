ALTER TABLE "roles" DROP CONSTRAINT "roles_department_id_departments_id_fk";
--> statement-breakpoint
ALTER TABLE "entity_fields" ALTER COLUMN "is_required" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "entity_fields" ALTER COLUMN "is_required" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "department_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;