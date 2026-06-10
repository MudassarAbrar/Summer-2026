-- Enable pgvector extension
create extension if not exists vector;

-- Add embedding column to ai_summaries
alter table public.ai_summaries
  add column if not exists embedding vector(768);

-- Create vector similarity search index (IVFFlat for fast approximate search)
create index if not exists idx_ai_summaries_embedding
  on public.ai_summaries
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Function for semantic search
-- Called from the app with a query embedding vector
create or replace function search_links(
  query_embedding  vector(768),
  user_id_param    uuid,
  match_count      int default 10
)
returns table (
  link_id          uuid,
  similarity       float
)
language sql stable
as $$
  select
    s.link_id,
    1 - (s.embedding <=> query_embedding) as similarity
  from public.ai_summaries s
  inner join public.links l on l.id = s.link_id
  where l.user_id = user_id_param
    and s.embedding is not null
  order by s.embedding <=> query_embedding
  limit match_count;
$$;
