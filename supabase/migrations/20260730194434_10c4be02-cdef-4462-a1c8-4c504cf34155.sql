ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free','pro','max'));

REVOKE UPDATE (plan) ON public.profiles FROM authenticated;
GRANT ALL ON public.profiles TO service_role;