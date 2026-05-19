-- Phase 13: add quiz_insights JSONB column to quizzes table
alter table quizzes
  add column if not exists quiz_insights jsonb default null;
