-- Phase 14: student_pdf_reports table
-- Stores per-student PDF download URLs after report generation.

create table if not exists student_pdf_reports (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete cascade not null,
  student_id  uuid references session_students(id) on delete cascade not null,
  pdf_url     text not null,
  created_at  timestamptz default now(),
  unique (session_id, student_id)
);

create index if not exists idx_student_pdf_reports_session
  on student_pdf_reports(session_id);

alter table student_pdf_reports enable row level security;
create policy "Public pdf read"  on student_pdf_reports for select using (true);
create policy "Public pdf write" on student_pdf_reports for insert with check (true);
create policy "Public pdf upsert" on student_pdf_reports for update using (true);
