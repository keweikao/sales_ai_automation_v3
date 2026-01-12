-- Migration: Add team_members table for manager-member relationships
-- Created: 2026-01-12

CREATE TABLE IF NOT EXISTS "team_members" (
  "id" text PRIMARY KEY NOT NULL,
  "manager_id" text NOT NULL,
  "member_id" text NOT NULL,
  "relationship_type" text DEFAULT 'direct',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "team_members_manager_member_unique" UNIQUE("manager_id", "member_id")
);

-- Add foreign key constraints
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_manager_id_user_id_fk"
  FOREIGN KEY ("manager_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "team_members" ADD CONSTRAINT "team_members_member_id_user_id_fk"
  FOREIGN KEY ("member_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Add indexes for query optimization
CREATE INDEX IF NOT EXISTS "team_members_manager_id_idx" ON "team_members" ("manager_id");
CREATE INDEX IF NOT EXISTS "team_members_member_id_idx" ON "team_members" ("member_id");
