-- Barn to Bank team moat sync table
create table if not exists public.moat_bundles (
  team_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists moat_bundles_updated_at_idx on public.moat_bundles (updated_at desc);

alter table public.moat_bundles enable row level security;

-- Service role bypasses RLS. Anon/authenticated policies for direct client access if needed later.
create policy "moat_bundles_read_team"
  on public.moat_bundles for select
  to authenticated, anon
  using (true);

create policy "moat_bundles_write_team"
  on public.moat_bundles for insert
  to authenticated, anon
  with check (true);

create policy "moat_bundles_update_team"
  on public.moat_bundles for update
  to authenticated, anon
  using (true)
  with check (true);

comment on table public.moat_bundles is 'Shared pipeline + comp lake bundles for Barn to Bank team sync';