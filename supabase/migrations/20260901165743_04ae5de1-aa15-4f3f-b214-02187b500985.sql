DROP FUNCTION IF EXISTS public.consume_message_quota(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.release_message_quota(uuid);

REVOKE ALL ON FUNCTION public.get_message_quota(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_message_quota(integer) TO authenticated, service_role;