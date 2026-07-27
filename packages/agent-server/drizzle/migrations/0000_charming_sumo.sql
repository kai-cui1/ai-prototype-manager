CREATE TYPE "public"."card_status" AS ENUM('pending', 'partial', 'applied', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."item_execution_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."memory_category" AS ENUM('user_preference', 'naming_convention', 'design_rule', 'domain_knowledge', 'workflow_habit', 'tool_usage');--> statement-breakpoint
CREATE TYPE "public"."memory_source" AS ENUM('auto_extract', 'user_manual');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."session_mode" AS ENUM('copilot', 'executor');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"context_refs" jsonb,
	"token_count" integer DEFAULT 0 NOT NULL,
	"is_compressed" boolean DEFAULT false NOT NULL,
	"compressed_content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200),
	"mode" "session_mode" DEFAULT 'copilot' NOT NULL,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"status" "card_status" DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_cards_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "recommendation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"kind" varchar(50) NOT NULL,
	"label" varchar(300) NOT NULL,
	"preview" text,
	"tool" varchar(100) NOT NULL,
	"args" jsonb NOT NULL,
	"selected" boolean DEFAULT true NOT NULL,
	"dependencies" jsonb,
	"execution_status" "item_execution_status" DEFAULT 'pending' NOT NULL,
	"execution_result" jsonb,
	"execution_error" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "memory_category" NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"source" "memory_source" NOT NULL,
	"source_session_id" uuid,
	"embedding" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_cards" ADD CONSTRAINT "recommendation_cards_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_items" ADD CONSTRAINT "recommendation_items_card_id_recommendation_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."recommendation_cards"("id") ON DELETE cascade ON UPDATE no action;