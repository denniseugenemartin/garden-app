-- Plants the user wants but doesn't have yet; shown on the wishlist instead of the garden.
alter table public.plants add column wishlist boolean not null default false;
