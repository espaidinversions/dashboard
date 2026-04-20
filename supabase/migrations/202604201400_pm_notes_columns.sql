-- Migration: add notes column to pm_ter_overrides and pm_position_overrides
-- 2026-04-20

alter table pm_ter_overrides       add column if not exists notes text;
alter table pm_position_overrides  add column if not exists notes text;
