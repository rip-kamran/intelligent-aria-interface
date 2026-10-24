CREATE TABLE public.code_usage (
  user_id uuid PRIMARY KEY,
  day_used integer NOT NULL DEFAULT 0,
  day_reset_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  month_used integer NOT NULL DEFAULT 0,
  month_reset_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.code_usage TO authenticated;
GRANT ALL ON public.code_usage TO service_role;
ALTER TABLE public.code_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own code usage" ON public.code_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.consume_code_quota(_user_id uuid, _day_limit integer, _month_limit integer, _cost integer)
RETURNS TABLE(allowed boolean, day_used integer, day_reset_at timestamptz, month_used integer, month_reset_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.code_usage%ROWTYPE;
BEGIN
  INSERT INTO public.code_usage(user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO r FROM public.code_usage c WHERE c.user_id = _user_id FOR UPDATE;
  IF r.day_reset_at <= now() THEN r.day_used := 0; r.day_reset_at := now() + interval '24 hours'; END IF;
  IF r.month_reset_at <= now() THEN r.month_used := 0; r.month_reset_at := now() + interval '30 days'; END IF;
  IF _cost > 0 AND (r.day_used >= _day_limit OR r.month_used >= _month_limit) THEN
    UPDATE public.code_usage SET day_used=r.day_used, day_reset_at=r.day_reset_at, month_used=r.month_used, month_reset_at=r.month_reset_at, updated_at=now() WHERE user_id=_user_id;
    RETURN QUERY SELECT false, r.day_used, r.day_reset_at, r.month_used, r.month_reset_at; RETURN;
  END IF;
  r.day_used := GREATEST(0, r.day_used + _cost); r.month_used := GREATEST(0, r.month_used + _cost);
  UPDATE public.code_usage SET day_used=r.day_used, day_reset_at=r.day_reset_at, month_used=r.month_used, month_reset_at=r.month_reset_at, updated_at=now() WHERE user_id=_user_id;
  RETURN QUERY SELECT true, r.day_used, r.day_reset_at, r.month_used, r.month_reset_at;
END $$;
REVOKE ALL ON FUNCTION public.consume_code_quota(uuid, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_code_quota(uuid, integer, integer, integer) TO service_role;

CREATE TABLE public.mcp_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  auth_header text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_servers TO authenticated;
GRANT ALL ON public.mcp_servers TO service_role;
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_mcp_servers" ON public.mcp_servers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX mcp_servers_user_idx ON public.mcp_servers(user_id);