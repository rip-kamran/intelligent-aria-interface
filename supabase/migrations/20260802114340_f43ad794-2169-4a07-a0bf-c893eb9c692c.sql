create extension if not exists vector;

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  kind text not null default 'fact',
  source_thread_id uuid,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.memories to authenticated;
grant all on public.memories to service_role;

alter table public.memories enable row level security;

create policy "own_memories" on public.memories for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists memories_user_idx on public.memories(user_id);
create index if not exists memories_embedding_idx on public.memories using hnsw (embedding vector_cosine_ops);

drop trigger if exists tg_memories_updated on public.memories;
create trigger tg_memories_updated before update on public.memories
  for each row execute function public.tg_touch_updated_at();

create or replace function public.match_memories(
  _user_id uuid,
  query_embedding vector(1536),
  match_count int default 6
)
returns table (id uuid, content text, kind text, similarity float)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.content, m.kind, 1 - (m.embedding <=> query_embedding) as similarity
  from public.memories m
  where m.user_id = _user_id and m.embedding is not null
  order by m.embedding <=> query_embedding
  limit match_count;
$$;

alter table public.profiles
  add column if not exists memory_enabled boolean not null default true,
  add column if not exists web_search_enabled boolean not null default true,
  add column if not exists response_style text not null default 'default',
  add column if not exists response_length text not null default 'balanced';