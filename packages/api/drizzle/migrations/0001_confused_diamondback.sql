CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'web' NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "biz_arch_process_map" (
	"id" text PRIMARY KEY NOT NULL,
	"architecture_id" text NOT NULL,
	"process_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_architectures" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"level" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_processes" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_process_id" text,
	"entry_node_id" text,
	"exit_node_ids" jsonb DEFAULT '[]',
	"config" jsonb DEFAULT '{}',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"company_type" text,
	"contact_info" jsonb DEFAULT '{}',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_flow_metadata" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"field_id" text NOT NULL,
	"sources" jsonb DEFAULT '[]',
	"destinations" jsonb DEFAULT '[]',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"company_id" text NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"contact_info" jsonb DEFAULT '{}',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_entities" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"category" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_fields" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"field_type" text NOT NULL,
	"is_required" text DEFAULT 'false' NOT NULL,
	"default_value" jsonb,
	"constraints" jsonb DEFAULT '{}',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"source_entity_id" text NOT NULL,
	"target_entity_id" text NOT NULL,
	"relation_kind" text NOT NULL,
	"target_cardinality" text DEFAULT '*' NOT NULL,
	"display_name" text,
	"description" text,
	"config" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_entities" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"company_id" text,
	"department_id" text,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"entity_type" text,
	"contact_info" jsonb DEFAULT '{}',
	"actions" jsonb DEFAULT '[]',
	"decisions" jsonb DEFAULT '[]',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menus" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"icon" text,
	"path" text,
	"menu_type" text DEFAULT 'menu' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"roles" jsonb DEFAULT '[]',
	"permissions" jsonb DEFAULT '[]',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_layout_regions" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"region_type" text NOT NULL,
	"region_name" text NOT NULL,
	"layout_config" jsonb DEFAULT '{}',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"page_type" text DEFAULT 'page' NOT NULL,
	"route_path" text,
	"associated_process_id" text,
	"layout_config" jsonb DEFAULT '{}',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_edges" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"source_node_id" text NOT NULL,
	"target_node_id" text NOT NULL,
	"mappings" jsonb DEFAULT '[]',
	"label" text,
	"condition" text,
	"config" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_node_map" (
	"id" text PRIMARY KEY NOT NULL,
	"process_id" text NOT NULL,
	"node_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"node_type" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"holder_type" text NOT NULL,
	"holder_id" text NOT NULL,
	"branches" jsonb DEFAULT '[]',
	"inputs" jsonb DEFAULT '[]',
	"outputs" jsonb DEFAULT '[]',
	"config" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"department_id" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"category" text,
	"contact_info" jsonb DEFAULT '{}',
	"actions" jsonb DEFAULT '[]',
	"decisions" jsonb DEFAULT '[]',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biz_arch_process_map" ADD CONSTRAINT "biz_arch_process_map_architecture_id_business_architectures_id_fk" FOREIGN KEY ("architecture_id") REFERENCES "public"."business_architectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biz_arch_process_map" ADD CONSTRAINT "biz_arch_process_map_process_id_business_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."business_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_architectures" ADD CONSTRAINT "business_architectures_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_architectures" ADD CONSTRAINT "business_architectures_parent_id_business_architectures_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."business_architectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_processes" ADD CONSTRAINT "business_processes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_processes" ADD CONSTRAINT "business_processes_parent_process_id_business_processes_id_fk" FOREIGN KEY ("parent_process_id") REFERENCES "public"."business_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_flow_metadata" ADD CONSTRAINT "data_flow_metadata_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_flow_metadata" ADD CONSTRAINT "data_flow_metadata_field_id_entity_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."entity_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_departments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_entities" ADD CONSTRAINT "domain_entities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_fields" ADD CONSTRAINT "entity_fields_entity_id_domain_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."domain_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_source_entity_id_domain_entities_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."domain_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_target_entity_id_domain_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."domain_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_entities" ADD CONSTRAINT "external_entities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_entities" ADD CONSTRAINT "external_entities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_entities" ADD CONSTRAINT "external_entities_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_parent_id_menus_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_layout_regions" ADD CONSTRAINT "page_layout_regions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_associated_process_id_business_processes_id_fk" FOREIGN KEY ("associated_process_id") REFERENCES "public"."business_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_edges" ADD CONSTRAINT "process_edges_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_edges" ADD CONSTRAINT "process_edges_source_node_id_process_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."process_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_edges" ADD CONSTRAINT "process_edges_target_node_id_process_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."process_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_node_map" ADD CONSTRAINT "process_node_map_process_id_business_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."business_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_node_map" ADD CONSTRAINT "process_node_map_node_id_process_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."process_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_nodes" ADD CONSTRAINT "process_nodes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applications_project_name_unique" ON "applications" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "idx_bizarch_process_map_arch" ON "biz_arch_process_map" USING btree ("architecture_id");--> statement-breakpoint
CREATE INDEX "idx_bizarch_process_map_process" ON "biz_arch_process_map" USING btree ("process_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bizarch_process_map_arch_process_unique" ON "biz_arch_process_map" USING btree ("architecture_id","process_id");--> statement-breakpoint
CREATE INDEX "idx_business_architectures_project" ON "business_architectures" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_business_architectures_parent" ON "business_architectures" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_architectures_project_name_unique" ON "business_architectures" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "idx_business_processes_project" ON "business_processes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_business_processes_parent" ON "business_processes" USING btree ("parent_process_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_processes_project_name_unique" ON "business_processes" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "idx_companies_project" ON "companies" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_project_name_unique" ON "companies" USING btree ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "data_flow_metadata_project_field_unique" ON "data_flow_metadata" USING btree ("project_id","field_id");--> statement-breakpoint
CREATE INDEX "idx_departments_project" ON "departments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_departments_company" ON "departments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_departments_parent" ON "departments" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_project_name_unique" ON "departments" USING btree ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "domain_entities_project_name_unique" ON "domain_entities" USING btree ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_fields_entity_name_unique" ON "entity_fields" USING btree ("entity_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_relations_project_source_target_kind_unique" ON "entity_relations" USING btree ("project_id","source_entity_id","target_entity_id","relation_kind");--> statement-breakpoint
CREATE INDEX "idx_external_entities_project" ON "external_entities" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_entities_project_name_unique" ON "external_entities" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "idx_menus_parent" ON "menus" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "page_layout_regions_page_region_unique" ON "page_layout_regions" USING btree ("page_id","region_name");--> statement-breakpoint
CREATE INDEX "idx_pages_application" ON "pages" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_application_name_unique" ON "pages" USING btree ("application_id","name");--> statement-breakpoint
CREATE INDEX "idx_process_edges_project" ON "process_edges" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_process_edges_source" ON "process_edges" USING btree ("source_node_id");--> statement-breakpoint
CREATE INDEX "idx_process_edges_target" ON "process_edges" USING btree ("target_node_id");--> statement-breakpoint
CREATE INDEX "idx_process_node_map_process" ON "process_node_map" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "idx_process_node_map_node" ON "process_node_map" USING btree ("node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "process_node_map_process_node_unique" ON "process_node_map" USING btree ("process_id","node_id");--> statement-breakpoint
CREATE INDEX "idx_process_nodes_project" ON "process_nodes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_process_nodes_holder" ON "process_nodes" USING btree ("project_id","holder_type","holder_id");--> statement-breakpoint
CREATE INDEX "idx_roles_project" ON "roles" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_roles_department" ON "roles" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_project_name_unique" ON "roles" USING btree ("project_id","name");