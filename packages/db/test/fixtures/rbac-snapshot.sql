--
-- A legacy snapshot shaped for the RBAC transform (#311, ADR-0056): the four
-- seeded roles and the cases its rules name. Manager Division and Staff are held
-- in two divisions each and split; Manager Finance is held in one and keeps its
-- id; Super Admin is a system role whose holder's division is dropped; Archivist
-- is held only in a Trashed division, and Auditor by nobody. STAFF differs from
-- Staff only by case. One unmapped permission exists for a second guard.
-- Three permissions have no catalogue key, one user holds a direct grant, one
-- holds a role with no division, and one live user holds nothing. A role and a
-- permission held by another model type (whose id is a user's) are not the user's.
--
-- Synthetic, like the other fixtures.
--

COPY master.divisions (id, name, code, deleted_at) FROM stdin;
d0000000-0000-4000-8000-000000000001	Operations	OPS	\N
d0000000-0000-4000-8000-000000000002	Trucking	TRK	\N
d0000000-0000-4000-8000-000000000003	Finance	FIN	\N
d0000000-0000-4000-8000-000000000004	Developer	DEV	\N
d0000000-0000-4000-8000-000000000005	Archive	ARC	2025-06-01 08:00:00
\.

COPY master.users (id, name, status, division_id, email, password, created_at, updated_at, deleted_at) FROM stdin;
b0000000-0000-4000-8000-000000000001	Dev Admin	active	d0000000-0000-4000-8000-000000000004	user1@example.test	$2y$10$fixture	2025-01-02 08:00:00	2025-01-02 08:00:00	\N
b0000000-0000-4000-8000-000000000002	Ops Manager	active	d0000000-0000-4000-8000-000000000001	user2@example.test	$2y$10$fixture	2025-01-02 08:00:00	2025-01-02 08:00:00	\N
b0000000-0000-4000-8000-000000000003	Trucking Manager	active	d0000000-0000-4000-8000-000000000002	user3@example.test	$2y$10$fixture	2025-01-02 08:00:00	2025-01-02 08:00:00	\N
b0000000-0000-4000-8000-000000000004	Ops Staff	active	d0000000-0000-4000-8000-000000000001	user4@example.test	$2y$10$fixture	2025-01-02 08:00:00	2025-01-02 08:00:00	\N
b0000000-0000-4000-8000-000000000005	Trucking Staff	active	d0000000-0000-4000-8000-000000000002	user5@example.test	$2y$10$fixture	2025-01-02 08:00:00	2025-01-02 08:00:00	\N
b0000000-0000-4000-8000-000000000006	Finance Manager	active	d0000000-0000-4000-8000-000000000003	user6@example.test	$2y$10$fixture	2025-01-02 08:00:00	2025-01-02 08:00:00	\N
b0000000-0000-4000-8000-000000000007	Floating Staff	active	\N	user7@example.test	$2y$10$fixture	2025-01-02 08:00:00	2025-01-02 08:00:00	\N
b0000000-0000-4000-8000-000000000008	Roleless User	active	d0000000-0000-4000-8000-000000000001	user8@example.test	$2y$10$fixture	2025-01-02 08:00:00	2025-01-02 08:00:00	\N
b0000000-0000-4000-8000-000000000009	Suspended User	suspended	d0000000-0000-4000-8000-000000000001	user9@example.test	$2y$10$fixture	2025-01-02 08:00:00	2025-01-02 08:00:00	\N
b0000000-0000-4000-8000-000000000010	Trashed User	active	d0000000-0000-4000-8000-000000000001	user10@example.test	$2y$10$fixture	2025-01-02 08:00:00	2025-01-02 08:00:00	2025-06-01 08:00:00
b0000000-0000-4000-8000-000000000011	Archive Keeper	active	d0000000-0000-4000-8000-000000000005	user11@example.test	$2y$10$fixture	2025-01-02 08:00:00	2025-01-02 08:00:00	\N
\.

COPY master.roles (uuid, name, guard_name, level, is_active, is_system, color_hex, icon_name, description, metadata, created_at, updated_at) FROM stdin;
c0000000-0000-4000-8000-000000000001	Super Admin	web	1	t	t	#AA0000	heroicon-o-shield-check	Every permission	{}	2025-01-02 08:00:00	2025-03-04 09:30:00
c0000000-0000-4000-8000-000000000002	Manager Division	web	2	t	f	#123456	heroicon-o-banknotes	Leads a division	{}	2025-01-02 08:00:00	2025-03-04 09:30:00
c0000000-0000-4000-8000-000000000003	Staff	web	3	t	f	#654321	heroicon-o-user	Works in a division	{}	2025-01-02 08:00:00	2025-03-04 09:30:00
c0000000-0000-4000-8000-000000000004	Manager Finance	web	2	f	f	red	heroicon-o-calculator	\N	{}	2025-01-02 08:00:00	2025-03-04 09:30:00
c0000000-0000-4000-8000-000000000005	Archivist	web	3	t	f	#0000ff	heroicon-o-arrow-left	\N	{}	2025-01-02 08:00:00	2025-03-04 09:30:00
c0000000-0000-4000-8000-000000000006	STAFF	web	3	t	f	#000000	heroicon-o-user	\N	{}	2025-01-02 08:00:00	2025-03-04 09:30:00
c0000000-0000-4000-8000-000000000007	Auditor	web	3	t	f	#336699	heroicon-o-scale	\N	{}	2025-01-02 08:00:00	2025-01-02 08:00:00
\.

COPY master.permissions (uuid, code, "group", name, guard_name, is_active, description, metadata, created_at, updated_at) FROM stdin;
e0000000-0000-4000-8000-000000000001	P1	master-users	master-users.view_any	web	t	master-users.view_any	\N	2025-01-02 08:00:00	2025-01-02 08:00:00
e0000000-0000-4000-8000-000000000002	P2	master-divisions	master-divisions.manager	web	t	master-divisions.manager	\N	2025-01-02 08:00:00	2025-01-02 08:00:00
e0000000-0000-4000-8000-000000000003	P3	trucking-orders	trucking-orders.view_any	web	t	trucking-orders.view_any	\N	2025-01-02 08:00:00	2025-01-02 08:00:00
e0000000-0000-4000-8000-000000000004	P4	trucking-orders	trucking-orders.create	web	t	trucking-orders.create	\N	2025-01-02 08:00:00	2025-01-02 08:00:00
e0000000-0000-4000-8000-000000000005	P5	warehouse-items	warehouse-items.view	web	t	warehouse-items.view	\N	2025-01-02 08:00:00	2025-01-02 08:00:00
e0000000-0000-4000-8000-000000000006	P6	trucking-orders	trucking-orders.create	api	t	trucking-orders.create	\N	2025-01-02 08:00:00	2025-01-02 08:00:00
\.

COPY spatie.role_has_permissions (permission_uuid, role_uuid) FROM stdin;
e0000000-0000-4000-8000-000000000001	c0000000-0000-4000-8000-000000000002
e0000000-0000-4000-8000-000000000002	c0000000-0000-4000-8000-000000000002
e0000000-0000-4000-8000-000000000003	c0000000-0000-4000-8000-000000000002
e0000000-0000-4000-8000-000000000001	c0000000-0000-4000-8000-000000000003
e0000000-0000-4000-8000-000000000002	c0000000-0000-4000-8000-000000000004
e0000000-0000-4000-8000-000000000004	c0000000-0000-4000-8000-000000000001
e0000000-0000-4000-8000-000000000001	c0000000-0000-4000-8000-000000000005
\.

COPY spatie.model_has_roles (role_uuid, model_type, model_id) FROM stdin;
c0000000-0000-4000-8000-000000000001	App\\Models\\Master\\User	b0000000-0000-4000-8000-000000000001
c0000000-0000-4000-8000-000000000002	App\\Models\\Master\\User	b0000000-0000-4000-8000-000000000002
c0000000-0000-4000-8000-000000000002	App\\Models\\Master\\User	b0000000-0000-4000-8000-000000000003
c0000000-0000-4000-8000-000000000003	App\\Models\\Master\\User	b0000000-0000-4000-8000-000000000004
c0000000-0000-4000-8000-000000000003	App\\Models\\Master\\User	b0000000-0000-4000-8000-000000000005
c0000000-0000-4000-8000-000000000004	App\\Models\\Master\\User	b0000000-0000-4000-8000-000000000006
c0000000-0000-4000-8000-000000000003	App\\Models\\Master\\User	b0000000-0000-4000-8000-000000000007
c0000000-0000-4000-8000-000000000005	App\\Models\\Master\\User	b0000000-0000-4000-8000-000000000011
c0000000-0000-4000-8000-000000000002	App\\Models\\Trucking\\Driver	b0000000-0000-4000-8000-000000000008
\.

COPY spatie.model_has_permissions (permission_uuid, model_type, model_id) FROM stdin;
e0000000-0000-4000-8000-000000000005	App\\Models\\Master\\User	b0000000-0000-4000-8000-000000000004
e0000000-0000-4000-8000-000000000005	App\\Models\\Trucking\\Driver	b0000000-0000-4000-8000-000000000005
\.
