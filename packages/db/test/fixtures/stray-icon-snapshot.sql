--
-- A snapshot whose divisions hold Heroicons names: one migration 0032 rewrites
-- to its catalogue icon, and two interface glyphs it has no icon for, which the
-- verifier must name rather than pass silently (#176).
--
-- Synthetic, like the other fixtures.
--

COPY master.divisions (id, name, code, icon_name) FROM stdin;
11111111-1111-4111-8111-111111111111	Trucking	TRK	heroicon-o-truck
22222222-2222-4222-8222-222222222222	Finance	FIN	heroicon-o-arrow-left
33333333-3333-4333-8333-333333333333	Warehouse	WHS	heroicon-m-x-mark
\.
