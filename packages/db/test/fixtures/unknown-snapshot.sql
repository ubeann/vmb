--
-- A snapshot holding a table the pipeline's manifest knows nothing about: not
-- ported, not excluded. That is schema drift, and the pipeline must warn rather
-- than carry it or drop it silently.
--
-- Synthetic, like the other fixtures.
--

COPY master.divisions (id, name, code) FROM stdin;
11111111-1111-4111-8111-111111111111	Operations	OPS
\.

COPY legacy.something_new (id, note) FROM stdin;
99999999-9999-4999-8999-999999999999	a table nobody told the pipeline about
\.
