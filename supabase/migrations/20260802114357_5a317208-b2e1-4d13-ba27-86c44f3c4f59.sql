revoke all on function public.match_memories(uuid, vector, int) from public, anon, authenticated;
grant execute on function public.match_memories(uuid, vector, int) to service_role;