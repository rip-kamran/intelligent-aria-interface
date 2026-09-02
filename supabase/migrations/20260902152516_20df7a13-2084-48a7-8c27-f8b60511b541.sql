ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own credit history" ON public.credit_ledger;
CREATE POLICY "Users read own credit history" ON public.credit_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS credit_ledger_user_idx ON public.credit_ledger(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.redeem_credits_for_plan(_plan text, _days integer, _cost integer)
RETURNS TABLE(credits integer, plan text, plan_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  bal integer;
  base timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _plan NOT IN ('pro','max') THEN RAISE EXCEPTION 'Invalid plan'; END IF;
  IF _days NOT IN (30) THEN RAISE EXCEPTION 'Invalid duration'; END IF;
  IF _cost IS NULL OR _cost < 0 OR _cost > 100000 THEN RAISE EXCEPTION 'Invalid cost'; END IF;

  SELECT p.credits INTO bal FROM public.profiles p WHERE p.id = uid FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF bal < _cost THEN RAISE EXCEPTION 'Not enough credits'; END IF;

  SELECT GREATEST(COALESCE(p.plan_expires_at, now()), now()) INTO base
    FROM public.profiles p WHERE p.id = uid;

  UPDATE public.profiles p
     SET credits = p.credits - _cost,
         plan = _plan,
         plan_expires_at = CASE WHEN p.plan = _plan THEN base ELSE now() END + make_interval(days => _days)
   WHERE p.id = uid;

  INSERT INTO public.credit_ledger(user_id, amount, reason)
  VALUES (uid, -_cost, 'Redeemed ' || _days || ' days of ' || _plan);

  RETURN QUERY SELECT p.credits, p.plan::text, p.plan_expires_at FROM public.profiles p WHERE p.id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_credits_for_plan(text, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_credits_for_plan(text, integer, integer) TO authenticated;