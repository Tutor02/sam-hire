
-- 1. Prevent role escalation on profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can change a profile role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_role_change ON public.profiles;
CREATE TRIGGER profiles_prevent_role_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_change();

-- Also add an INSERT-side guard: new profiles must be 'customer' unless inserted by an admin / service role
CREATE OR REPLACE FUNCTION public.enforce_profile_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.role IS DISTINCT FROM 'customer' AND NOT public.is_admin(auth.uid()) THEN
    NEW.role := 'customer';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_default_role ON public.profiles;
CREATE TRIGGER profiles_enforce_default_role
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_default_role();

-- 2. candidates.user_id NOT NULL with safe default + WITH CHECK
UPDATE public.candidates SET user_id = (SELECT id FROM public.profiles LIMIT 1) WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles);
DELETE FROM public.candidates WHERE user_id IS NULL;
ALTER TABLE public.candidates ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.candidates ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS "Users manage their candidates" ON public.candidates;
CREATE POLICY "Users manage their candidates"
ON public.candidates
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Same hardening for jobs
DELETE FROM public.jobs WHERE user_id IS NULL;
ALTER TABLE public.jobs ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.jobs ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS "Users manage their jobs" ON public.jobs;
CREATE POLICY "Users manage their jobs"
ON public.jobs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Restrict EXECUTE on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_role_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_profile_default_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
-- is_admin must remain executable by authenticated since it's used inside RLS policies
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
