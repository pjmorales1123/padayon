-- PADAYON Database Schema
-- Drop tables in reverse dependency order to allow clean re-runs
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS topics CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS learner_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS curriculum_items CASCADE;

-- Users table (TEXT id so demo/external ids like "demo-user-id" work)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learner profiles table
CREATE TABLE IF NOT EXISTS learner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  language_confidence JSONB DEFAULT '{}'::JSONB,
  learning_style JSONB DEFAULT '{}'::JSONB,
  strengths JSONB DEFAULT '[]'::JSONB,
  weaknesses JSONB DEFAULT '[]'::JSONB,
  study_habits JSONB DEFAULT '{}'::JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Topics table
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subcategory TEXT,
  curriculum_match JSONB DEFAULT '{}'::JSONB,
  progress JSONB DEFAULT '{}'::JSONB,
  last_studied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subject_id, title)
);

-- Materials table
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Curriculum items table
CREATE TABLE IF NOT EXISTS curriculum_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_level TEXT,
  subject TEXT,
  subcategory TEXT,
  topic TEXT,
  competency TEXT,
  previous_topic TEXT,
  next_topic TEXT,
  UNIQUE(topic)
);

-- Seed curriculum data
INSERT INTO curriculum_items
(grade_level, subject, subcategory, topic, competency, previous_topic, next_topic)
VALUES
('Grade 9', 'Science', 'Biology', 'Photosynthesis', 'Explain how plants make food through photosynthesis.', 'Plant structures', 'Cellular respiration'),
('Grade 9', 'Science', 'Biology', 'Cellular Respiration', 'Explain how cells release energy from food.', 'Photosynthesis', 'Ecosystem'),
('Grade 9', 'Science', 'Biology', 'Ecosystem', 'Explain interactions among living things and their environment.', 'Cellular Respiration', NULL),
('Grade 9', 'Math', 'Algebra', 'Factoring', 'Factor polynomials using appropriate methods.', NULL, 'Quadratic Equations'),
('Grade 9', 'Math', 'Algebra', 'Quadratic Equations', 'Solve quadratic equations using different methods.', 'Factoring', 'Quadratic Formula'),
('Grade 9', 'Math', 'Algebra', 'Quadratic Formula', 'Solve quadratic equations using the quadratic formula.', 'Quadratic Equations', NULL),
('Grade 9', 'English', 'Literature', 'Point of View', 'Identify and analyze point of view in literary texts.', NULL, 'Characterization'),
('Grade 9', 'English', 'Literature', 'Characterization', 'Analyze how characters are developed in a text.', 'Point of View', 'Irony'),
('Grade 9', 'English', 'Literature', 'Irony', 'Identify and explain irony in literary texts.', 'Characterization', NULL)
ON CONFLICT (topic) DO NOTHING;

-- Seed demo user
INSERT INTO users (id, name) VALUES ('demo-user-id', 'Prince')
ON CONFLICT (id) DO NOTHING;

-- Seed demo learner profile
INSERT INTO learner_profiles
(user_id, language_confidence, learning_style, strengths, weaknesses, study_habits)
VALUES
('demo-user-id',
 '{"English": "High", "Filipino": "Medium", "Cebuano": "Developing", "Academic English": "Developing"}'::JSONB,
 '{"analogies": true, "visuals": true, "short_explanations": true}'::JSONB,
 '["Real-life examples", "Story-based explanations", "Diagrams"]'::JSONB,
 '["Scientific vocabulary", "Process order in Photosynthesis"]'::JSONB,
 '{"preferred_time": "evening", "review_frequency": "daily"}'::JSONB
)
ON CONFLICT (user_id) DO NOTHING;
