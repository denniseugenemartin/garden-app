-- Move SECURITY DEFINER helpers out of the API-exposed public schema so they can't be called via /rest/v1/rpc.
-- Policies and triggers reference functions by OID, so they keep working after the move.

create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.is_garden_member(uuid) set schema private;
alter function public.is_garden_owner(uuid) set schema private;
alter function public.handle_new_user() set schema private;
alter function public.add_garden_owner() set schema private;

-- Trigger functions don't need EXECUTE grants to fire.
revoke execute on function private.handle_new_user() from public, anon, authenticated;
revoke execute on function private.add_garden_owner() from public, anon, authenticated;
