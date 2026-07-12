-- Allows the agent to recognize the demo lesson as a Grade 9 curriculum topic.
INSERT INTO curriculum_items
  (grade_level, subject, subcategory, topic, competency, previous_topic, next_topic)
VALUES
  (
    'Grade 9',
    'English',
    'Literature',
    'Types of Conflict in Literature',
    'Identify and explain person vs. person, self, society, and nature conflicts in literary texts.',
    'Characterization',
    'Point of View'
  )
ON CONFLICT (topic) DO UPDATE SET
  grade_level = EXCLUDED.grade_level,
  subject = EXCLUDED.subject,
  subcategory = EXCLUDED.subcategory,
  competency = EXCLUDED.competency,
  previous_topic = EXCLUDED.previous_topic,
  next_topic = EXCLUDED.next_topic;
