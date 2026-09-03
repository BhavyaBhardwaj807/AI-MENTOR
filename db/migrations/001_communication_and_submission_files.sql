CREATE TABLE IF NOT EXISTS teacher_student_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES users(id),
  student_id uuid NOT NULL REFERENCES users(id),
  sender_role varchar(20) NOT NULL CHECK (sender_role IN ('teacher', 'student')),
  content text NOT NULL CHECK (length(trim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS teacher_student_messages_conversation_idx
  ON teacher_student_messages (teacher_id, student_id, created_at);

ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS file_size integer;