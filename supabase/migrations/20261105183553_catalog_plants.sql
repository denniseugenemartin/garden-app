-- Shared copy of the NC State Plant Toolbox plant list, used for species search.
-- Filled and refreshed (at most monthly) by the catalog-sync edge function.

create extension if not exists pg_trgm with schema extensions;

create table public.catalog_plants (
  slug text primary key,
  scientific_name text not null,
  common_names text[] not null default '{}',
  -- Lowercased scientific name then common names, one per line, for substring search.
  search_text text not null,
  synced_at timestamptz not null default now()
);

-- Trigram index makes the '%term%' searches below fast.
create index catalog_plants_search_idx on public.catalog_plants
  using gin (search_text extensions.gin_trgm_ops);
create index catalog_plants_scientific_name_idx on public.catalog_plants (lower(scientific_name));
create index catalog_plants_synced_at_idx on public.catalog_plants (synced_at);

alter table public.catalog_plants enable row level security;

create policy "Signed-in users read the catalog" on public.catalog_plants
  for select to authenticated using (true);

grant select on public.catalog_plants to authenticated;
grant select, insert, update, delete on public.catalog_plants to service_role;

-- Plants whose scientific or common name contains the term, names starting with it first.
create function public.search_catalog(term text, max_results int default 50)
returns table (slug text, scientific_name text, common_names text[])
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select replace(replace(replace(lower(trim(term)), '\', '\\'), '%', '\%'), '_', '\_') as t
  )
  select c.slug, c.scientific_name, c.common_names
  from public.catalog_plants c, q
  where length(q.t) >= 2 and c.search_text like '%' || q.t || '%'
  order by
    (c.search_text like q.t || '%' or c.search_text like '%' || chr(10) || q.t || '%') desc,
    c.scientific_name
  limit least(max_results, 100);
$$;

revoke execute on function public.search_catalog(text, int) from public, anon;
grant execute on function public.search_catalog(text, int) to authenticated;
