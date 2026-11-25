-- Objectifs hebdomadaires par matière (minutes) et coefficients de concours (clé matière → nombre).
alter table public.settings
  add column if not exists weekly_goals jsonb not null default '{}'::jsonb,
  add column if not exists coefficients jsonb not null default '{}'::jsonb,
  add column if not exists target_average numeric not null default 12;
