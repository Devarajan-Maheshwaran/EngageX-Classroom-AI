-- Phase 11: quizzes + quiz_responses tables

create table if not exists quizzes (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete cascade not null,
  teacher_id  text not null,
  question    text not null,
  quiz_type   text not null default 'mcq' check (quiz_type in ('mcq','poll','short')),
  options     jsonb default '[]',
  correct_id  text,
  duration_s  integer not null default 30,
  status      text not null default 'active' check (status in ('active','closed')),
  created_at  timestamptz default now()
);

create table if not exists quiz_responses (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid references quizzes(id) on delete cascade not null,
  session_id  uuid references sessions(id) on delete cascade not null,
  student_id  uuid references session_students(id) on delete cascade not null,
  answer_id   text,
  answer_text text,
  is_correct  boolean,
  created_at  timestamptz default now(),
  unique (quiz_id, student_id)   -- one response per student per quiz
);

create index if not exists idx_quizzes_session     on quizzes(session_id, created_at desc);
create index if not exists idx_responses_quiz      on quiz_responses(quiz_id);
create index if not exists idx_responses_student   on quiz_responses(student_id);

alter table quizzes         enable row level security;
alter table quiz_responses  enable row level security;

create policy "Public quiz read"     on quizzes        for select using (true);
create policy "Public response write" on quiz_responses for insert with check (true);
create policy "Public response read"  on quiz_responses for select using (true);
