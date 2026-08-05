CREATE OR REPLACE FUNCTION public.consume_message_quota(_user_id uuid, _limit integer, _window_hours integer)
RETURNS TABLE(allowed boolean, used integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.usage_daily;
  now_ts timestamptz := now();
  key date := '1970-01-01'::date;
BEGIN
  IF _limit IS NULL OR _limit < 0 THEN
    RAISE EXCEPTION 'invalid limit';
  END IF;

  INSERT INTO public.usage_daily (user_id, day, message_count, reset_at)
  VALUES (_user_id, key, 0, now_ts + make_interval(hours => _window_hours))
  ON CONFLICT (user_id, day) DO NOTHING;

  SELECT * INTO rec FROM public.usage_daily
   WHERE user_id = _user_id AND day = key
   FOR UPDATE;

  IF rec.reset_at <= now_ts THEN
    UPDATE public.usage_daily
       SET message_count = 0, reset_at = now_ts + make_interval(hours => _window_hours)
     WHERE user_id = _user_id AND day = key
     RETURNING * INTO rec;
  END IF;

  IF rec.message_count >= _limit THEN
    RETURN QUERY SELECT false, rec.message_count, rec.reset_at;
    RETURN;
  END IF;

  UPDATE public.usage_daily
     SET message_count = message_count + 1
   WHERE user_id = _user_id AND day = key
   RETURNING * INTO rec;

  RETURN QUERY SELECT true, rec.message_count, rec.reset_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_message_quota(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.usage_daily
     SET message_count = GREATEST(message_count - 1, 0)
   WHERE user_id = _user_id AND day = '1970-01-01'::date;
$$;

CREATE OR REPLACE FUNCTION public.get_message_quota(_window_hours integer)
RETURNS TABLE(used integer, reset_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE WHEN u.reset_at IS NULL OR u.reset_at <= now() THEN 0 ELSE u.message_count END,
    COALESCE(
      CASE WHEN u.reset_at IS NULL OR u.reset_at <= now() THEN NULL ELSE u.reset_at END,
      now() + make_interval(hours => _window_hours)
    )
  FROM (SELECT 1) s
  LEFT JOIN public.usage_daily u
    ON u.user_id = auth.uid() AND u.day = '1970-01-01'::date;
$$;

REVOKE ALL ON FUNCTION public.consume_message_quota(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_message_quota(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_message_quota(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_message_quota(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_message_quota(integer) TO authenticated, service_role;