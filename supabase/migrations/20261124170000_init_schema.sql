-- Planning+ : schéma initial (phases 1 à 4)
-- Toutes les tables : id, user_id (RLS user_id = auth.uid()), created_at, updated_at.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Réglages et comptes
-- ---------------------------------------------------------------------------
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  week_a_reference_date date not null default '2026-11-23',
  primary_calendar_id text not null default 'primary',
  kholles_calendar_id text,
  planning_calendar_id text,
  tasks_list_id text,
  session_rules jsonb not null default '{}'::jsonb,
  holidays jsonb not null default '[]'::jsonb,
  notification_prefs jsonb not null default '{"bilan": true, "kholle": true, "homework": true, "sunday": true}'::jsonb,
  neglected_after_days int not null default 7,
  last_sync_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tokens Google chiffrés côté app (AES-256-GCM). Aucune policy : service role uniquement.
create table public.google_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  access_token_enc text,
  refresh_token_enc text,
  expires_at timestamptz,
  scopes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Matières et éléments
-- ---------------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  name text not null,
  color text not null,
  teacher text,
  google_color_id text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create table public.subject_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  type text not null default 'chapitre',
  title text not null,
  number int,
  description text,
  archived boolean not null default false,
  last_worked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Événements Google
-- ---------------------------------------------------------------------------
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  google_calendar_id text not null,
  google_event_id text not null,
  kind text not null default 'autre' check (kind in ('cours', 'ds', 'kholle', 'autre')),
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null default '',
  location text,
  description text,
  color_id text,
  all_day boolean not null default false,
  start_at timestamptz not null,
  end_at timestamptz not null,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, google_calendar_id, google_event_id)
);

create table public.event_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  calendar_event_id uuid not null unique references public.calendar_events(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  clear_subject boolean not null default false,
  kind text check (kind in ('cours', 'ds', 'kholle', 'autre')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- DS, concours blancs, khôlles
-- ---------------------------------------------------------------------------
create table public.cb_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  calendar_event_id uuid not null unique references public.calendar_events(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  number int,
  cb_period_id uuid references public.cb_periods(id) on delete set null,
  cb_candidate boolean not null default false,
  grade numeric,
  grade_max numeric not null default 20,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kholles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  calendar_event_id uuid not null unique references public.calendar_events(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  teacher text,
  grade numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prep_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('ds', 'kholle')),
  target_id uuid not null,
  subject_item_id uuid references public.subject_items(id) on delete set null,
  title text not null,
  status text not null default 'a_voir' check (status in ('a_voir', 'vu', 'revu', 'maitrise')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prep_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('ds', 'kholle')),
  target_id uuid not null,
  title text not null,
  description text,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kholle_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kholle_id uuid not null references public.kholles(id) on delete cascade,
  question text not null,
  status text not null default 'a_revoir' check (status in ('a_revoir', 'ok')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Devoirs
-- ---------------------------------------------------------------------------
create table public.homework (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz,
  estimated_minutes int,
  priority text not null default 'normale' check (priority in ('basse', 'normale', 'haute')),
  status text not null default 'a_faire' check (status in ('a_faire', 'en_cours', 'fait')),
  done_at timestamptz,
  google_task_id text,
  google_synced_at timestamptz,
  related_event_id uuid references public.calendar_events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Study Planner
-- ---------------------------------------------------------------------------
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  kind text not null default 'etude' check (kind in ('etude', 'maison', 'suggestion', 'bibliotheque', 'sport', 'libre')),
  status text not null default 'prevue' check (status in ('suggeree', 'prevue', 'ignoree', 'bilan_fait')),
  location text,
  notes text,
  google_event_id text,
  google_synced_at timestamptz,
  generated_by_rule text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);
create unique index study_sessions_rule_unique
  on public.study_sessions (user_id, date, generated_by_rule)
  where generated_by_rule is not null;

create table public.session_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  item_type text not null check (item_type in ('homework', 'revision', 'prep_task', 'sport')),
  homework_id uuid references public.homework(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  subject_item_id uuid references public.subject_items(id) on delete set null,
  prep_task_id uuid references public.prep_tasks(id) on delete set null,
  description text,
  planned_minutes int not null default 0,
  actual_minutes int,
  done boolean not null default false,
  origin text not null default 'prevu' check (origin in ('prevu', 'ajoute_au_bilan')),
  removed_in_review boolean not null default false,
  target text not null default 'none' check (target in ('next_ds', 'next_kholle', 'none')),
  target_ds_id uuid references public.ds(id) on delete set null,
  target_kholle_id uuid references public.kholles(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid not null unique references public.study_sessions(id) on delete cascade,
  reviewed_at timestamptz,
  planned_snapshot jsonb not null default '[]'::jsonb,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.focus_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_item_id uuid not null references public.session_items(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Post-its et liens
-- ---------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null,
  color text not null default 'yellow',
  pinned boolean not null default false,
  done boolean not null default false,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url text not null,
  label text,
  target_type text not null default 'global' check (target_type in ('subject', 'subject_item', 'ds', 'cb_period', 'kholle', 'homework', 'prep_task', 'global')),
  target_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Phase 3-4 : push, tokens API, journal des notifications
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  token_prefix text not null,
  scopes text[] not null default array['read', 'write'],
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

-- ---------------------------------------------------------------------------
-- Triggers updated_at, RLS, index
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'settings', 'google_accounts', 'subjects', 'subject_items', 'calendar_events', 'event_overrides',
    'cb_periods', 'ds', 'kholles', 'prep_topics', 'prep_tasks', 'kholle_questions', 'homework',
    'study_sessions', 'session_items', 'session_reviews', 'focus_logs', 'notes', 'links',
    'push_subscriptions', 'api_tokens', 'notification_log'
  ];
  -- Tables accessibles uniquement via la service role (pas de policy).
  service_only text[] := array['google_accounts', 'notification_log'];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
    if not (t = any(service_only)) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
        t || '_owner', t
      );
    end if;
    if t not in ('settings', 'google_accounts') then
      execute format('create index %I on public.%I (user_id)', t || '_user_id_idx', t);
    end if;
  end loop;
end;
$$;

create index calendar_events_start_idx on public.calendar_events (user_id, start_at);
create index calendar_events_subject_idx on public.calendar_events (subject_id);
create index event_overrides_subject_idx on public.event_overrides (subject_id);
create index subject_items_subject_idx on public.subject_items (subject_id);
create index ds_subject_idx on public.ds (subject_id);
create index ds_cb_period_idx on public.ds (cb_period_id);
create index kholles_subject_idx on public.kholles (subject_id);
create index prep_topics_target_idx on public.prep_topics (target_type, target_id);
create index prep_topics_subject_item_idx on public.prep_topics (subject_item_id);
create index prep_tasks_target_idx on public.prep_tasks (target_type, target_id);
create index kholle_questions_kholle_idx on public.kholle_questions (kholle_id);
create index homework_due_idx on public.homework (user_id, due_at);
create index homework_subject_idx on public.homework (subject_id);
create index homework_related_event_idx on public.homework (related_event_id);
create index study_sessions_start_idx on public.study_sessions (user_id, start_at);
create index session_items_session_idx on public.session_items (session_id);
create index session_items_homework_idx on public.session_items (homework_id);
create index session_items_subject_idx on public.session_items (subject_id);
create index session_items_subject_item_idx on public.session_items (subject_item_id);
create index session_items_prep_task_idx on public.session_items (prep_task_id);
create index session_items_target_ds_idx on public.session_items (target_ds_id);
create index session_items_target_kholle_idx on public.session_items (target_kholle_id);
create index focus_logs_item_idx on public.focus_logs (session_item_id);
create index links_target_idx on public.links (target_type, target_id);
