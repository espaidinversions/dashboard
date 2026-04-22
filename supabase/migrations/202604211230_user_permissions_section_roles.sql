-- Migration: explicit section access levels
-- Adds per-section access roles on top of the legacy denied_sections array.

ALTER TABLE user_permissions
  ADD COLUMN IF NOT EXISTS section_roles JSONB NOT NULL DEFAULT '{}'::jsonb;
