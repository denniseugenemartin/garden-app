-- The project doesn't auto-grant new tables, so the toolbox-plant edge function (service role)
-- needs explicit access to cache NC State data. Users still only get read access.
grant select, insert, update on public.toolbox_plants to service_role;
