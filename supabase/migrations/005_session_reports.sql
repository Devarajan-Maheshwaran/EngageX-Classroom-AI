-- Phase 12: session_reports table
-- Stores generated end-of-session reports as JSON blobs.

create table if not exists session_reports (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete cascade not null,
  report_data jsonb not null,
  created_at  timestamptz default now()
);

create index if not exists idx_session_reports_session
  on session_reports(session_id, created_at desc);

alter table session_reports enable row level security;
create policy "Public report read"
  on session_reports for select using (true);
create policy "Public report write"
  on session_reports for insert with check (true);
