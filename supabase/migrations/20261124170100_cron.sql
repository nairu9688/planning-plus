-- Déclencheur toutes les 15 min (remplace Vercel Cron, limité à 1/jour en Hobby).
-- Les secrets `app_url` et `cron_secret` sont à créer dans Supabase Vault (hors migration) :
--   select vault.create_secret('https://<app>.vercel.app', 'app_url');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.planning_plus_tick()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;
  return net.http_post(
    url := v_url || '/api/cron/tick',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function public.planning_plus_tick() from public, anon, authenticated;

select cron.schedule('planning-plus-tick', '*/15 * * * *', 'select public.planning_plus_tick()');
