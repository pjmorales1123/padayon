ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS student_notes JSONB DEFAULT '[]'::JSONB;
