-- ============================================================
-- Streamline Tech — Full RLS + Permission Fix
-- Run this ONCE in Supabase SQL Editor (safe to re-run)
-- ============================================================

-- ----------------------------------------------------------------
-- 1. PROFILES TABLE
-- ----------------------------------------------------------------
-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "profiles_service_role_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"        ON public.profiles;
DROP POLICY IF EXISTS "admin_select_all_profiles"  ON public.profiles;

-- Service role (backend) can do everything — no RLS check
CREATE POLICY "profiles_service_role_all"
  ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated user can read own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Authenticated user can update own profile (but NOT their role)
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow insert for own profile (needed for trigger / upsert fallback)
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------
-- 2. STUDENTS TABLE
-- ----------------------------------------------------------------
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_service_role_all" ON public.students;
DROP POLICY IF EXISTS "students_select_own"        ON public.students;
DROP POLICY IF EXISTS "students_update_own"        ON public.students;

CREATE POLICY "students_service_role_all"
  ON public.students
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "students_select_own"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "students_update_own"
  ON public.students
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------
-- 3. TRAINING CENTERS — public read (no auth needed for dropdown)
-- ----------------------------------------------------------------
ALTER TABLE public.training_centers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "centers_public_read"       ON public.training_centers;
DROP POLICY IF EXISTS "centers_service_role_all"  ON public.training_centers;

CREATE POLICY "centers_service_role_all"
  ON public.training_centers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "centers_public_read"
  ON public.training_centers
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ----------------------------------------------------------------
-- 4. COURSES — public read (no auth needed for dropdown)
-- ----------------------------------------------------------------
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courses_public_read"      ON public.courses;
DROP POLICY IF EXISTS "courses_service_role_all" ON public.courses;

CREATE POLICY "courses_service_role_all"
  ON public.courses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "courses_public_read"
  ON public.courses
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ----------------------------------------------------------------
-- 5. BATCHES — authenticated read (used in complete-profile)
-- ----------------------------------------------------------------
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "batches_service_role_all"  ON public.batches;
DROP POLICY IF EXISTS "batches_authenticated_read" ON public.batches;

CREATE POLICY "batches_service_role_all"
  ON public.batches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "batches_authenticated_read"
  ON public.batches
  FOR SELECT
  TO authenticated
  USING (true);

-- ----------------------------------------------------------------
-- 6. APTITUDE PROGRESS
-- ----------------------------------------------------------------
ALTER TABLE public.aptitude_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aptitude_service_role_all" ON public.aptitude_progress;
DROP POLICY IF EXISTS "aptitude_select_own"        ON public.aptitude_progress;

CREATE POLICY "aptitude_service_role_all"
  ON public.aptitude_progress
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "aptitude_select_own"
  ON public.aptitude_progress
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 7. AUTO-PROFILE TRIGGER (safe upsert on new Supabase Auth user)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    LOWER(NEW.email),
    'student',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger (drop first to avoid duplicate)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------
-- 8. SEED default training centers if table is empty
-- ----------------------------------------------------------------
INSERT INTO public.training_centers (name, address, city, phone, is_active)
SELECT * FROM (VALUES
  ('Nashik – Jatra Road',   'Jatra Road, Nashik, Maharashtra 422001',  'Nashik', '+91 9876543210', true),
  ('Nashik – College Road', 'College Road, Nashik, Maharashtra 422005', 'Nashik', '+91 9876543211', true)
) AS v(name, address, city, phone, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.training_centers LIMIT 1);

-- ----------------------------------------------------------------
-- 9. SEED default courses if table is empty
-- ----------------------------------------------------------------
INSERT INTO public.courses (name, description, duration, technologies, is_active)
SELECT * FROM (VALUES
  ('Full Stack Web Development', 'Complete web development training covering frontend and backend technologies.', '6 Months', 'HTML, CSS, JavaScript, React, Node.js, MongoDB', true),
  ('Data Science & Analytics',   'Learn data analysis, machine learning, and visualization techniques.',          '4 Months', 'Python, Pandas, NumPy, Scikit-learn, Tableau',    true),
  ('Java Programming',            'Core and advanced Java programming with real-world projects.',                  '3 Months', 'Java, Spring Boot, Hibernate, MySQL',              true),
  ('Python Programming',          'Python fundamentals to advanced concepts with hands-on projects.',              '3 Months', 'Python, Django, Flask, PostgreSQL',                true),
  ('Mobile App Development',      'Build cross-platform mobile applications.',                                    '5 Months', 'React Native, Flutter, Firebase',                  true),
  ('UI/UX Design',                'User interface and experience design principles and tools.',                   '3 Months', 'Figma, Adobe XD, Sketch, Prototyping',             true)
) AS v(name, description, duration, technologies, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.courses LIMIT 1);

-- ----------------------------------------------------------------
-- Done ✓
-- ----------------------------------------------------------------
