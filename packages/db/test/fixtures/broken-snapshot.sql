--
-- A snapshot whose rows do not match its own column list: the divisions row has
-- three values for four columns. The pipeline must report this as an error, not
-- crash, and must not silently load a truncated row.
--
-- Synthetic, like the other fixtures.
--

COPY master.divisions (id, name, code, description) FROM stdin;
11111111-1111-4111-8111-111111111111	Operations	OPS
\.
