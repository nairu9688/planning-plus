-- PostgREST ne sait pas cibler un index unique partiel dans ON CONFLICT :
-- contrainte unique classique (les NULL restent distincts → sessions manuelles non concernées).
drop index if exists public.study_sessions_rule_unique;
alter table public.study_sessions
  add constraint study_sessions_rule_unique unique (user_id, date, generated_by_rule);

-- Toute modification d'un élément « touche » sa session (pour la resynchro vers Google).
create or replace function public.touch_parent_session()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.study_sessions
    set updated_at = now()
    where id = coalesce(new.session_id, old.session_id);
  return null;
end;
$$;

create trigger session_items_touch_session
  after insert or update or delete on public.session_items
  for each row execute function public.touch_parent_session();
