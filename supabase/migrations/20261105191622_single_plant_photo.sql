-- A plant has one primary photo. It can be the user's own, one of the plant's journal photos,
-- or an NC State photo (which keeps its photographer credit and license link).

alter table public.plants drop column reference_photo_key;
alter table public.plants rename column reference_photo_credit to photo_credit;
alter table public.plants rename column reference_photo_license_url to photo_license_url;

-- Lets the photos edge function skip deleting a photo that's still in use elsewhere.
grant select on public.plants, public.journal_entries to service_role;
create index plants_photo_key_idx on public.plants (photo_key) where photo_key is not null;
create index journal_entries_photo_key_idx on public.journal_entries (photo_key) where photo_key is not null;
