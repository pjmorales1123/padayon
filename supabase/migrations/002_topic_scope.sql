-- Add school-aligned lesson boundary and mastery tracking to topics.
alter table if exists topics
  add column if not exists teacher_confirmed boolean default false,
  add column if not exists lesson_scope jsonb default '{}'::jsonb,
  add column if not exists outside_scope jsonb default '{}'::jsonb,
  add column if not exists mastery_map jsonb default '{}'::jsonb;
