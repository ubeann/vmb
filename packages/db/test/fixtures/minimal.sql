-- Minimal synthetic slice: one row per core entity, spanning three schemas.
-- Values are invented for the harness; none of this comes from production.

INSERT INTO master.divisions (id, name, code, description, color_hex, icon_name, is_active)
VALUES ('11111111-1111-4111-8111-111111111111', 'Operations', 'OPS', 'Fixture division', '#112233', 'heroicon-o-cube', true);

INSERT INTO master.users (id, name, status, email)
VALUES ('22222222-2222-4222-8222-222222222222', 'Fixture User', 'active', 'fixture.user@example.test');

INSERT INTO trucking.clients (id, name, code)
VALUES ('33333333-3333-4333-8333-333333333333', 'Fixture Client', 'CL-001');

INSERT INTO trucking.orders (id, client_id, code, type, party_count, status)
VALUES ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', 1001, 'export', 1, 'draft');

INSERT INTO warehouse.items (id, division_id, name, code, icon_name, current_stock, reorder_level)
VALUES ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'Fixture Item', 'IT-001', 'heroicon-o-cube', 10, 2);
