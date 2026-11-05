-- USDA plant hardiness zone, e.g. '7b'.
alter table public.profiles
  add column hardiness_zone text check (hardiness_zone ~ '^(1[0-3]|[1-9])[ab]$');
