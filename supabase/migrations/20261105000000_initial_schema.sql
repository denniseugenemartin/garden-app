-- Initial schema for My Garden.
-- Users sign in with Supabase Auth; each user gets a default garden on signup.
-- Gardens can later have multiple members, so access is checked via garden membership.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.gardens (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Garden',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.garden_members (
  garden_id uuid not null references public.gardens (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (garden_id, user_id)
);

-- Shared NC State Plant Toolbox data, one row per species/cultivar page.
-- Read-only for users; written only by a server-side function using the service role.
create table public.toolbox_plants (
  slug text primary key,
  scientific_name text not null,
  description text,
  sections jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now()
);

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens (id) on delete cascade,
  common_name text not null check (length(trim(common_name)) > 0),
  scientific_name text,
  cultivar text,
  location text,
  acquired_on date,
  notes text,
  -- Keys into blob storage, not URLs (URLs are signed on demand).
  photo_key text,
  reference_photo_key text,
  reference_photo_credit text,
  reference_photo_license_url text,
  toolbox_slug text references public.toolbox_plants (slug) on delete set null,
  -- Only the user's edits to the NC State info ({ description?, sections? }); null when unedited.
  toolbox_overrides jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  entry_date date not null default current_date,
  text text,
  photo_key text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (text is not null or photo_key is not null)
);

create index garden_members_user_idx on public.garden_members (user_id);
create index plants_garden_idx on public.plants (garden_id);
create index plants_toolbox_slug_idx on public.plants (toolbox_slug);
create index journal_entries_plant_idx on public.journal_entries (plant_id, entry_date desc);

-- ---------------------------------------------------------------------------
-- Helpers and triggers
-- ---------------------------------------------------------------------------

-- security definer so RLS policies can check membership without recursing into garden_members' own policies.
create function public.is_garden_member(target_garden uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.garden_members
    where garden_id = target_garden and user_id = (select auth.uid())
  );
$$;

create function public.is_garden_owner(target_garden uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.garden_members
    where garden_id = target_garden and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

-- New users get a profile and a default garden (on_garden_created makes them its owner).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');

  insert into public.gardens (created_by) values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Gardens created later (not via signup) make their creator the owner.
create function public.add_garden_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.garden_members (garden_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_garden_created
  after insert on public.gardens
  for each row execute function public.add_garden_owner();

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger plants_set_updated_at
  before update on public.plants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.gardens enable row level security;
alter table public.garden_members enable row level security;
alter table public.toolbox_plants enable row level security;
alter table public.plants enable row level security;
alter table public.journal_entries enable row level security;

-- profiles: users see and edit only their own.
create policy "Users read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Users update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- gardens: members read; anyone signed in can create their own; owners rename/delete.
create policy "Members read gardens" on public.gardens
  for select to authenticated using (public.is_garden_member(id));
create policy "Users create gardens" on public.gardens
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "Owners update gardens" on public.gardens
  for update to authenticated using (public.is_garden_owner(id)) with check (public.is_garden_owner(id));
create policy "Owners delete gardens" on public.gardens
  for delete to authenticated using (public.is_garden_owner(id));

-- garden_members: members see who else is in the garden; owners manage membership; anyone can leave.
create policy "Members read membership" on public.garden_members
  for select to authenticated using (public.is_garden_member(garden_id));
create policy "Owners add members" on public.garden_members
  for insert to authenticated with check (public.is_garden_owner(garden_id));
create policy "Owners change roles" on public.garden_members
  for update to authenticated using (public.is_garden_owner(garden_id)) with check (public.is_garden_owner(garden_id));
create policy "Owners remove members or members leave" on public.garden_members
  for delete to authenticated using (public.is_garden_owner(garden_id) or user_id = (select auth.uid()));

-- toolbox_plants: readable by any signed-in user; no write policies (service role only).
create policy "Signed-in users read toolbox plants" on public.toolbox_plants
  for select to authenticated using (true);

-- plants: full access for members of the plant's garden.
create policy "Members read plants" on public.plants
  for select to authenticated using (public.is_garden_member(garden_id));
create policy "Members add plants" on public.plants
  for insert to authenticated with check (public.is_garden_member(garden_id));
create policy "Members update plants" on public.plants
  for update to authenticated using (public.is_garden_member(garden_id)) with check (public.is_garden_member(garden_id));
create policy "Members delete plants" on public.plants
  for delete to authenticated using (public.is_garden_member(garden_id));

-- journal_entries: access follows the plant's garden.
create policy "Members read journal" on public.journal_entries
  for select to authenticated using (
    exists (select 1 from public.plants p where p.id = plant_id and public.is_garden_member(p.garden_id))
  );
create policy "Members add journal entries" on public.journal_entries
  for insert to authenticated with check (
    exists (select 1 from public.plants p where p.id = plant_id and public.is_garden_member(p.garden_id))
  );
create policy "Members update journal entries" on public.journal_entries
  for update to authenticated using (
    exists (select 1 from public.plants p where p.id = plant_id and public.is_garden_member(p.garden_id))
  ) with check (
    exists (select 1 from public.plants p where p.id = plant_id and public.is_garden_member(p.garden_id))
  );
create policy "Members delete journal entries" on public.journal_entries
  for delete to authenticated using (
    exists (select 1 from public.plants p where p.id = plant_id and public.is_garden_member(p.garden_id))
  );
