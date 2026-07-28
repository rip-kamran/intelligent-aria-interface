CREATE TABLE public.usage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);

GRANT SELECT ON public.usage_daily TO authenticated;
GRANT ALL ON public.usage_daily TO service_role;

ALTER TABLE public.usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage"
  ON public.usage_daily FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER usage_daily_touch_updated_at
  BEFORE UPDATE ON public.usage_daily
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Increments and returns the caller's message count for today.
CREATE OR REPLACE FUNCTION public.increment_daily_usage()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.usage_daily (user_id, day, message_count)
  VALUES (auth.uid(), (now() AT TIME ZONE 'utc')::date, 1)
  ON CONFLICT (user_id, day)
  DO UPDATE SET message_count = public.usage_daily.message_count + 1
  RETURNING message_count INTO v_count;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_daily_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_daily_usage() TO authenticated;