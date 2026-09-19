--
-- A snapshot holding a row that predates a fix: this Expense request carries the
-- old lowercase 'pending' status, which 0017 corrected the *default* to
-- 'PENDING' but 0018 refuses as a value.
--
-- It is here because the ledger documents exactly that risk, and the pipeline
-- has to report it as a finding rather than crash. Synthetic, like the others.
--

COPY master.divisions (id, name, code) FROM stdin;
bbbb0000-0000-4000-8000-000000000000	Legacy Status Division	LSD
\.

COPY expense.requests (id, division_id, type, status) FROM stdin;
bbbb1111-1111-4111-8111-111111111111	bbbb0000-0000-4000-8000-000000000000	NICHE	pending
\.
