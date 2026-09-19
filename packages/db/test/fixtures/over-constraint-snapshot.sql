--
-- A snapshot whose rows violate a constraint the hygiene migrations add: this
-- Division carries no `code`, and 0004 requires one.
--
-- The import must report the failing statement rather than crash — which is the
-- behaviour the ledger's risk note claims, and the thing that makes the risk
-- survivable. Synthetic, like the other fixtures.
--

COPY master.divisions (id, name, description) FROM stdin;
eeee1111-1111-4111-8111-111111111111	Division Without A Code	A division that predates the requirement
\.
