--
-- Synthetic legacy data snapshot in `pg_dump --data-only` shape.
--
-- Written by hand for the harness; none of it comes from production. It covers
-- the shapes the loader and verifier must survive: a tab inside a value, a
-- backslash, a single quote, an unquoted null, a value that looks like the null
-- marker, and rows for tables the pipeline deliberately excludes.
--

COPY master.divisions (id, name, code, description, color_hex, icon_name, is_active, created_at, updated_at, deleted_at) FROM stdin;
11111111-1111-4111-8111-111111111111	Operations	OPS	Fixture division	#112233	heroicon-o-cube	t	2026-01-02 08:00:00	2026-01-02 08:00:00	\N
\.

COPY master.users (id, name, status, division_id, phone, email, email_verified_at, profile_photo_path, password, remember_token, created_at, updated_at, deleted_at) FROM stdin;
22222222-2222-4222-8222-222222222222	Fixture User	active	11111111-1111-4111-8111-111111111111	+62 812 0000	quote'and\\backslash@example.test	\N	\N	$2y$10$fixturefixturefixturefixturefixturefixturefixturefixtu	\N	2026-01-02 08:00:00	2026-01-02 08:00:00	\N
\.

COPY trucking.clients (id, name, code, pic, email, phone, address, logo_path, created_at, updated_at, deleted_at) FROM stdin;
33333333-3333-4333-8333-333333333333	Fixture Client	CL-001	\N	\N	\N	line one\nline two	\N	2026-01-02 08:00:00	2026-01-02 08:00:00	\N
\.

COPY trucking.orders (id, client_id, code, type, party_count, status, evidence_path, created_at, updated_at, deleted_at, direction, trip_count, additional_files, additional_allowances, reference_code, client_truck_company_id, reference_id, cancelled_at, cancelled_by, cancel_reason, custom_invoice_codes, submitted_for_payment_at, payment_received_at, payment_documents, payment_notes) FROM stdin;
44444444-4444-4444-8444-444444444444	33333333-3333-4333-8333-333333333333	1001	export	1	draft	\N	2026-01-02 08:00:00	2026-01-02 08:00:00	\N	import	0	\N	\N	REF-1001	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.

COPY warehouse.items (id, division_id, name, code, description, icon_name, current_stock, reorder_level, created_at, updated_at) FROM stdin;
55555555-5555-4555-8555-555555555555	11111111-1111-4111-8111-111111111111	Fixture Item	IT-001	\N	heroicon-o-cube	10	2	2026-01-02 08:00:00	2026-01-02 08:00:00
\.

-- Excluded tables: the pipeline does not load these, even though they are
-- present in the snapshot; the RBAC transform reads them from it (#311).
COPY master.roles (uuid, name, guard_name, level, is_system, created_at, updated_at) FROM stdin;
66666666-6666-4666-8666-666666666666	Super Admin	web	1	t	2026-01-02 08:00:00	2026-01-02 08:00:00
\.

COPY master.permissions (uuid, name, guard_name) FROM stdin;
77777777-7777-4777-8777-777777777777	master-users.view_any	web
\.

COPY spatie.role_has_permissions (permission_uuid, role_uuid) FROM stdin;
77777777-7777-4777-8777-777777777777	66666666-6666-4666-8666-666666666666
\.

COPY spatie.model_has_roles (role_uuid, model_type, model_id) FROM stdin;
66666666-6666-4666-8666-666666666666	App\\Models\\Master\\User	22222222-2222-4222-8222-222222222222
\.

COPY trucking.drivers (id, name, date_of_birth, identification_number, license_number, phone, address, profile_photo_path, created_at, updated_at, deleted_at) FROM stdin;
88888888-8888-4888-8888-888888888888	Fixture Driver	1990-01-15	KTP-001	SIM-001	+62 812 1111	Driver address	\N	2026-01-02 08:00:00	2026-01-02 08:00:00	\N
\.

COPY warehouse.stock_requisitions (id, requisition_number, requester_id, item_id, status, requested_quantity, stock_on_hand, purpose, created_at, updated_at, completed_at) FROM stdin;
77777777-7777-4777-8777-777777777771	SR-001	22222222-2222-4222-8222-222222222222	55555555-5555-4555-8555-555555555555	pending_approval	2	10	Fixture requisition	2026-01-02 08:00:00	2026-01-02 08:00:00	\N
\.

COPY expense.budgets (id, division_id, is_active, amount, created_at, updated_at) FROM stdin;
aaaa1111-1111-4111-8111-111111111111	11111111-1111-4111-8111-111111111111	t	5000000.00	2026-01-02 08:00:00	2026-01-02 08:00:00
\.

COPY expense.requests (id, user_id, division_id, type, status, created_at, updated_at, deleted_at) FROM stdin;
aaaa2222-2222-4222-8222-222222222222	22222222-2222-4222-8222-222222222222	11111111-1111-4111-8111-111111111111	NICHE	PENDING	2026-01-02 08:00:00	2026-01-02 08:00:00	\N
\.

COPY expense.request_niche_details (id, request_id, amount, notes, created_at, updated_at) FROM stdin;
aaaa3333-3333-4333-8333-333333333333	aaaa2222-2222-4222-8222-222222222222	1500000.00	Fixture justification	2026-01-02 08:00:00	2026-01-02 08:00:00
\.

-- a morph type keeps its backslashes: COPY escapes them, so \\ is one
COPY expense.approvals (id, approvable_type, approvable_id, approver_id, type, approved, created_at, updated_at) FROM stdin;
aaaa4444-4444-4444-8444-444444444444	App\\Models\\Expense\\Request	aaaa2222-2222-4222-8222-222222222222	22222222-2222-4222-8222-222222222222	finance	t	2026-01-02 08:00:00	2026-01-02 08:00:00
\.
