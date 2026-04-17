-- Migration: align pipeline schema with app data model
-- 2026-04-13

alter table pipeline
  add column if not exists estimated_closing text;
