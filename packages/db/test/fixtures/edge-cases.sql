-- Data the legacy schema permits but the domain does not:
--
--   * a user holding no Role, so no permissions and no division
--   * a procurement request that takes the schema's default status rather than
--     naming one (the default is a valid value since #106 corrected it)
--   * an approval whose approvable_id matches no row — the morph target has no
--     foreign key to enforce it
--   * a soft-deleted order, and one cancelled without a cancelled_by user
--   * a cross-schema reference: a warehouse item owned by a master division
--
-- Values are invented for the harness; none of this comes from production.

INSERT INTO master.divisions (id, name, code, color_hex, icon_name, is_active)
VALUES ('a1111111-1111-4111-8111-111111111111', 'Edge Division', 'EDGE', '#445566', 'heroicon-o-cube', true);

INSERT INTO master.users (id, name, status, email)
VALUES ('a2222222-2222-4222-8222-222222222222', 'Roleless User', 'active', 'no.role@example.test');

INSERT INTO master.users (id, name, status, email)
VALUES ('a2222222-2222-4222-8222-222222222223', 'Approver User', 'active', 'approver@example.test');

INSERT INTO trucking.clients (id, name, code)
VALUES ('a3333333-3333-4333-8333-333333333333', 'Edge Client', 'CL-EDGE');

INSERT INTO trucking.orders (id, client_id, code, type, party_count, status, deleted_at)
VALUES ('a4444444-4444-4444-8444-444444444444', 'a3333333-3333-4333-8333-333333333333', 2001, 'import', 1, 'cancelled', now());

INSERT INTO trucking.orders (id, client_id, code, type, party_count, status, cancel_reason, cancelled_by)
VALUES ('a4444444-4444-4444-8444-444444444445', 'a3333333-3333-4333-8333-333333333333', 2002, 'import', 1, 'cancelled', 'Client withdrew', NULL);

INSERT INTO trucking.approvals (id, approvable_type, approvable_id, approver_id, type, approved)
VALUES ('a5555555-5555-4555-8555-555555555555', 'App\Models\Trucking\Order', 'a9999999-9999-4999-8999-999999999999', 'a2222222-2222-4222-8222-222222222223', 'DTP', false);

INSERT INTO warehouse.items (id, division_id, name, code, icon_name, current_stock, reorder_level)
VALUES ('a6666666-6666-4666-8666-666666666666', 'a1111111-1111-4111-8111-111111111111', 'Cross-schema Item', 'IT-EDGE', 'heroicon-o-cube', 0, 5);

INSERT INTO warehouse.procurement_requests (id, request_number, requester_id, item_id, unit_price, requested_quantity, total_amount, justification)
VALUES ('a7777777-7777-4777-8777-777777777777', 'PR-EDGE-001', 'a2222222-2222-4222-8222-222222222223', 'a6666666-6666-4666-8666-666666666666', 1000.00, 3, 3000.00, 'Fixture request taking the schema default status');
