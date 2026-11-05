-- The project doesn't auto-expose new tables to the Data API, so grant signed-in users access explicitly.
-- Row level security still decides which rows they can see. Signed-out (anon) users get nothing.

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.gardens to authenticated;
grant select, insert, update, delete on public.garden_members to authenticated;
grant select on public.toolbox_plants to authenticated;
grant select, insert, update, delete on public.plants to authenticated;
grant select, insert, update, delete on public.journal_entries to authenticated;

-- RLS policies call these as the signed-in user; nobody else needs them.
revoke execute on function public.is_garden_member(uuid) from public, anon;
revoke execute on function public.is_garden_owner(uuid) from public, anon;
grant execute on function public.is_garden_member(uuid) to authenticated;
grant execute on function public.is_garden_owner(uuid) to authenticated;
