-- One row per photo stored in R2, so the photos edge function can enforce storage limits.
-- Only the edge function (service role) reads or writes it.

create table public.photo_objects (
  key text primary key,
  garden_id uuid not null references public.gardens (id) on delete cascade,
  bytes bigint not null check (bytes > 0),
  created_at timestamptz not null default now()
);

create index photo_objects_garden_idx on public.photo_objects (garden_id);

alter table public.photo_objects enable row level security;

grant select, insert, delete on public.photo_objects to service_role;

-- Photo count in one garden and total bytes stored across all gardens.
create function public.photo_usage(target_garden uuid)
returns table (garden_photos bigint, total_bytes bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select count(*) from public.photo_objects where garden_id = target_garden),
    (select coalesce(sum(bytes), 0)::bigint from public.photo_objects);
$$;

revoke execute on function public.photo_usage(uuid) from public, anon, authenticated;
grant execute on function public.photo_usage(uuid) to service_role;
