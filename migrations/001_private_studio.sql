-- Run once in Supabase SQL Editor. One durable account; no browser access to the ledger.
create schema if not exists studio_private;
revoke all on schema studio_private from public, anon, authenticated;
create table if not exists studio_private.account (
  id boolean primary key default true check (id),
  revision bigint not null default 0,
  state jsonb,
  updated_at timestamptz not null default now()
);
insert into studio_private.account (id) values (true) on conflict do nothing;
alter table studio_private.account enable row level security;
revoke all on studio_private.account from public, anon, authenticated;

create or replace function public.studio_read() returns jsonb
language sql security definer set search_path = '' as $$
 select jsonb_build_object('revision', revision, 'state', state)
 from studio_private.account where id = true;
$$;
create or replace function public.studio_write(expected_revision bigint, next_state jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
 if next_state->>'schemaVersion' is distinct from '1' or octet_length(next_state::text) > 9000000 then
   raise exception 'Invalid Studio state';
 end if;
 update studio_private.account set state = next_state, revision = revision + 1, updated_at = now()
 where id = true and revision = expected_revision;
 return found;
end;
$$;
revoke all on function public.studio_read() from public, anon, authenticated;
revoke all on function public.studio_write(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.studio_read() to service_role;
grant execute on function public.studio_write(bigint,jsonb) to service_role;
