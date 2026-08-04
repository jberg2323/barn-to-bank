-- Barn to Bank feature request intake (team-visible, server-persisted)
create table if not exists public.feature_requests (
  id text primary key,
  team_id text not null default 'barn-to-bank-team',
  name text not null,
  email text,
  type text not null,
  priority text not null,
  title text not null,
  description text not null,
  context text,
  submitted_at timestamptz not null default now(),
  status text not null default 'new'
);

create index if not exists feature_requests_team_submitted_idx
  on public.feature_requests (team_id, submitted_at desc);

alter table public.feature_requests enable row level security;

create policy "feature_requests_read_team"
  on public.feature_requests for select
  to authenticated, anon
  using (true);

create policy "feature_requests_insert_team"
  on public.feature_requests for insert
  to authenticated, anon
  with check (true);

comment on table public.feature_requests is 'Partner feature requests from Barn to Bank staff app';