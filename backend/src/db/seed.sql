-- AssetFlow Realistic Seed Data
-- Deterministic UUIDs used for relationships consistency

-- Password hash for 'password123': $2a$10$zRcuC6L/8lM5B1hR9cRDuO5P5QW6Lq2C.N3s8J2O/eQ2e577o0W82
-- Clean table entries
TRUNCATE roles, departments, users, asset_categories, assets, asset_allocations, transfer_requests, resource_bookings, maintenance_requests, audit_cycles, audit_auditors, audit_records, notifications, activity_logs CASCADE;

-- 1. Insert Roles
INSERT INTO roles (id, name, description) VALUES
('00000000-0000-0000-0000-000000000001', 'ADMIN', 'System Administrator with full access to organization setups, directories, and configuration.'),
('00000000-0000-0000-0000-000000000002', 'ASSET_MANAGER', 'Asset Manager responsible for asset registration, allocations, transfer approvals, maintenance approvals, and audit cycle completion.'),
('00000000-0000-0000-0000-000000000003', 'DEPARTMENT_HEAD', 'Department Head who manages department specific assets, approves internal transfer requests, and books resources on behalf of their department.'),
('00000000-0000-0000-0000-000000000004', 'EMPLOYEE', 'Standard organization employee who views allocated assets, books shared resources, and raises maintenance requests.');

-- 2. Insert Departments (temporary head_id is NULL to avoid circular foreign key)
INSERT INTO departments (id, name, parent_department_id, status) VALUES
('11111111-1111-1111-1111-111111111111', 'Engineering', NULL, 'ACTIVE'),
('11111111-1111-1111-1111-111111111112', 'Facilities', NULL, 'ACTIVE'),
('11111111-1111-1111-1111-111111111113', 'Operations', NULL, 'ACTIVE'),
('11111111-1111-1111-1111-111111111114', 'Field Ops (East)', '11111111-1111-1111-1111-111111111113', 'INACTIVE');

-- 3. Insert Users (Seeded passwords are 'password123')
INSERT INTO users (id, name, email, password_hash, role_id, department_id, status) VALUES
('22222222-2222-2222-2222-222222222221', 'Aditi Rao', 'admin@company.com', '$2a$10$zRcuC6L/8lM5B1hR9cRDuO5P5QW6Lq2C.N3s8J2O/eQ2e577o0W82', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ACTIVE'),
('22222222-2222-2222-2222-222222222222', 'Rohan Mehta', 'manager@company.com', '$2a$10$zRcuC6L/8lM5B1hR9cRDuO5P5QW6Lq2C.N3s8J2O/eQ2e577o0W82', '00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111112', 'ACTIVE'),
('22222222-2222-2222-2222-222222222223', 'Sana Iqbal', 'head@company.com', '$2a$10$zRcuC6L/8lM5B1hR9cRDuO5P5QW6Lq2C.N3s8J2O/eQ2e577o0W82', '00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111113', 'ACTIVE'),
('22222222-2222-2222-2222-222222222224', 'Priya Shah', 'priya@company.com', '$2a$10$zRcuC6L/8lM5B1hR9cRDuO5P5QW6Lq2C.N3s8J2O/eQ2e577o0W82', '00000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'ACTIVE'),
('22222222-2222-2222-2222-222222222225', 'Raj Patel', 'raj@company.com', '$2a$10$zRcuC6L/8lM5B1hR9cRDuO5P5QW6Lq2C.N3s8J2O/eQ2e577o0W82', '00000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'ACTIVE'),
('22222222-2222-2222-2222-222222222226', 'Arjun Nair', 'arjun@company.com', '$2a$10$zRcuC6L/8lM5B1hR9cRDuO5P5QW6Lq2C.N3s8J2O/eQ2e577o0W82', '00000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111113', 'ACTIVE');

-- Link head_id for departments
UPDATE departments SET head_id = '22222222-2222-2222-2222-222222222221' WHERE id = '11111111-1111-1111-1111-111111111111'; -- Engineering Head: Aditi
UPDATE departments SET head_id = '22222222-2222-2222-2222-222222222222' WHERE id = '11111111-1111-1111-1111-111111111112'; -- Facilities Head: Rohan
UPDATE departments SET head_id = '22222222-2222-2222-2222-222222222223' WHERE id = '11111111-1111-1111-1111-111111111113'; -- Operations Head: Sana
UPDATE departments SET head_id = '22222222-2222-2222-2222-222222222223' WHERE id = '11111111-1111-1111-1111-111111111114'; -- Field Ops Head: Sana

-- 4. Insert Asset Categories
INSERT INTO asset_categories (id, name, custom_fields) VALUES
('33333333-3333-3333-3333-333333333331', 'Electronics', '{"warranty_period_months": "number", "processor": "string", "ram_gb": "number"}'::jsonb),
('33333333-3333-3333-3333-333333333332', 'Furniture', '{"material": "string", "dimensions": "string"}'::jsonb),
('33333333-3333-3333-3333-333333333333', 'Vehicles', '{"license_plate": "string", "mileage": "number", "fuel_type": "string"}'::jsonb);

-- 5. Insert Assets
INSERT INTO assets (id, name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, condition, location, is_shared_bookable, status, department_id, current_holder_id, category_fields) VALUES
-- Allocated Dell Laptop
('44444444-4444-4444-4444-444444444411', 'Dell Latitude 5420', '33333333-3333-3333-3333-333333333331', 'AF-0012', 'SN-DELL-9921A', '2025-01-10', 1200.00, 'Good', 'Bengaluru Office', FALSE, 'ALLOCATED', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222224', '{"warranty_period_months": 36, "processor": "Intel i5", "ram_gb": 16}'::jsonb),
-- Under Maintenance Projector
('44444444-4444-4444-4444-444444444412', 'Epson Projector H200', '33333333-3333-3333-3333-333333333331', 'AF-0062', 'SN-EPSON-4412Z', '2024-05-18', 850.00, 'Fair', 'HQ Floor 2 - Meeting Room C', TRUE, 'UNDER_MAINTENANCE', NULL, NULL, '{"warranty_period_months": 24, "processor": "N/A", "ram_gb": 0}'::jsonb),
-- Available Office Chair
('44444444-4444-4444-4444-444444444413', 'Ergonomic Office Chair', '33333333-3333-3333-3333-333333333332', 'AF-0201', 'SN-CHAIR-112', '2025-11-01', 250.00, 'New', 'HQ Warehouse', FALSE, 'AVAILABLE', NULL, NULL, '{"material": "Mesh", "dimensions": "65x65x120cm"}'::jsonb),
-- Allocated Dell Laptop
('44444444-4444-4444-4444-444444444414', 'Dell Latitude 5420', '33333333-3333-3333-3333-333333333331', 'AF-0114', 'SN-DELL-9988X', '2025-01-10', 1200.00, 'Good', 'Bengaluru Office', FALSE, 'ALLOCATED', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222224', '{"warranty_period_months": 36, "processor": "Intel i5", "ram_gb": 16}'::jsonb),
-- Available Conference Room
('44444444-4444-4444-4444-444444444415', 'Conference Room B2', '33333333-3333-3333-3333-333333333332', 'AF-0999', 'SN-ROOM-B2', '2023-08-01', 15000.00, 'Good', 'HQ Floor 1', TRUE, 'AVAILABLE', NULL, NULL, '{"material": "Wood & Glass", "dimensions": "10x6m"}'::jsonb),
-- Available Shared Shuttle Van
('44444444-4444-4444-4444-444444444416', 'Ford Transit Van', '33333333-3333-3333-3333-333333333333', 'AF-0343', 'SN-FORD-VAN44', '2022-03-12', 32000.00, 'Fair', 'HQ Garage', TRUE, 'AVAILABLE', NULL, NULL, '{"license_plate": "KA-01-MJ-1234", "mileage": 42000, "fuel_type": "Diesel"}'::jsonb),
-- Available Office Desk
('44444444-4444-4444-4444-444444444417', 'Standing Desk E14', '33333333-3333-3333-3333-333333333332', 'AF-9921', 'SN-DESK-9921', '2024-06-15', 450.00, 'Good', 'Desk E14 - Eng Bay', FALSE, 'AVAILABLE', NULL, NULL, '{"material": "Oak Wood", "dimensions": "120x60x80cm"}'::jsonb),
-- Available Monitor
('44444444-4444-4444-4444-444444444418', 'Dell 27-inch Monitor', '33333333-3333-3333-3333-333333333331', 'AF-9838', 'SN-MON-9838', '2024-06-15', 300.00, 'Poor', 'Desk E15 - Eng Bay', FALSE, 'AVAILABLE', NULL, NULL, '{"warranty_period_months": 24, "processor": "N/A", "ram_gb": 0}'::jsonb);

-- 6. Insert Asset Allocations (History)
INSERT INTO asset_allocations (id, asset_id, user_id, department_id, allocated_by, allocated_at, expected_return_at, returned_at, check_in_notes, status) VALUES
-- Historic allocation: Dell Laptop AF-0012 was previously allocated to Arjun Nair and returned
('55555555-5555-5555-5555-555555555501', '44444444-4444-4444-4444-444444444411', '22222222-2222-2222-2222-222222222226', NULL, '22222222-2222-2222-2222-222222222222', '2026-01-04 09:00:00+05:30', '2026-02-04 18:00:00+05:30', '2026-01-15 11:30:00+05:30', 'Returned in perfect condition. Laptop reset completed.', 'RETURNED'),
-- Active allocation: Dell Laptop AF-0012 allocated to Priya Shah
('55555555-5555-5555-5555-555555555502', '44444444-4444-4444-4444-444444444411', '22222222-2222-2222-2222-222222222224', NULL, '22222222-2222-2222-2222-222222222222', '2026-03-12 10:00:00+05:30', NULL, NULL, NULL, 'ACTIVE'),
-- Active allocation: Dell Laptop AF-0114 allocated to Priya Shah
('55555555-5555-5555-5555-555555555503', '44444444-4444-4444-4444-444444444414', '22222222-2222-2222-2222-222222222224', NULL, '22222222-2222-2222-2222-222222222222', '2026-03-12 10:00:00+05:30', NULL, NULL, NULL, 'ACTIVE');

-- 7. Insert Transfer Requests
INSERT INTO transfer_requests (id, asset_id, from_user_id, from_department_id, to_user_id, to_department_id, requested_by, status, approved_by, approval_notes) VALUES
-- Pending transfer request: Raj Patel wants Dell Laptop AF-0114 currently held by Priya Shah
('66666666-6666-6666-6666-666666666601', '44444444-4444-4444-4444-444444444414', '22222222-2222-2222-2222-222222222224', NULL, '22222222-2222-2222-2222-222222222225', NULL, '22222222-2222-2222-2222-222222222225', 'PENDING', NULL, NULL);

-- 8. Insert Resource Bookings
-- Note: Setting specific dates using relative calculations to ensure they are current relative to mock run (July 2026)
INSERT INTO resource_bookings (id, asset_id, booked_by, booked_for_department_id, start_time, end_time, status) VALUES
-- Ongoing booking for Conference Room B2 (9 AM to 10 AM, July 12 2026)
('77777777-7777-7777-7777-777777777701', '44444444-4444-4444-4444-444444444415', '22222222-2222-2222-2222-222222222225', '11111111-1111-1111-1111-111111111111', '2026-07-12 09:00:00+05:30', '2026-07-12 10:00:00+05:30', 'ONGOING'),
-- Upcoming booking for Conference Room B2 (2 PM to 3 PM, July 13 2026)
('77777777-7777-7777-7777-777777777702', '44444444-4444-4444-4444-444444444415', '22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111113', '2026-07-13 14:00:00+05:30', '2026-07-13 15:00:00+05:30', 'UPCOMING');

-- 9. Insert Maintenance Requests
INSERT INTO maintenance_requests (id, asset_id, raised_by, description, priority, status, technician_id) VALUES
-- Projector under maintenance
('88888888-8888-8888-8888-888888888801', '44444444-4444-4444-4444-444444444412', '22222222-2222-2222-2222-222222222224', 'Projector bulb not turning on. Suspected power supply issue.', 'MEDIUM', 'TECHNICIAN_ASSIGNED', '22222222-2222-2222-2222-222222222222'),
-- Pending laptop maintenance
('88888888-8888-8888-8888-888888888802', '44444444-4444-4444-4444-444444444414', '22222222-2222-2222-2222-222222222224', 'Laptop keyboard keys (E, R, T) not responding.', 'LOW', 'PENDING', NULL);

-- 10. Insert Audit Cycles
INSERT INTO audit_cycles (id, name, scope_department_id, scope_location, start_date, end_date, status) VALUES
-- Active Audit Cycle
('99999999-9999-9999-9999-999999999901', 'Q3 Audit: Engineering Dept', '11111111-1111-1111-1111-111111111111', 'Bengaluru Office', '2026-07-01', '2026-07-15', 'ACTIVE');

-- 11. Assign Auditors (Many-to-Many)
INSERT INTO audit_auditors (audit_cycle_id, auditor_id) VALUES
('99999999-9999-9999-9999-999999999901', '22222222-2222-2222-2222-222222222221'), -- Admin Aditi
('99999999-9999-9999-9999-999999999901', '22222222-2222-2222-2222-222222222223'); -- Dept Head Sana

-- 12. Insert Audit Records (Flagged discrepancies)
INSERT INTO audit_records (id, audit_cycle_id, asset_id, auditor_id, status, notes) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999901', '44444444-4444-4444-4444-444444444411', '22222222-2222-2222-2222-222222222221', 'VERIFIED', 'Asset located and verified in employee possession.'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '99999999-9999-9999-9999-999999999901', '44444444-4444-4444-4444-444444444417', '22222222-2222-2222-2222-222222222223', 'MISSING', 'Desk is empty. Employee claims it was moved, but location unknown.'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '99999999-9999-9999-9999-999999999901', '44444444-4444-4444-4444-444444444418', '22222222-2222-2222-2222-222222222221', 'DAMAGED', 'Monitor screen is cracked, unit does not power on.');

-- 13. Insert Notifications
INSERT INTO notifications (id, user_id, title, message, type, is_read, reference_entity_type, reference_entity_id) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddd01', '22222222-2222-2222-2222-222222222224', 'Asset Laptop Assigned', 'Dell Latitude 5420 (AF-0012) has been allocated to you.', 'ASSET_ASSIGNED', FALSE, 'assets', '44444444-4444-4444-4444-444444444411'),
('dddddddd-dddd-dddd-dddd-dddddddddd02', '22222222-2222-2222-2222-222222222222', 'New Maintenance Request', 'Priya Shah raised a maintenance request for Dell Laptop (AF-0114).', 'MAINTENANCE_APPROVED', FALSE, 'maintenance_requests', '88888888-8888-8888-8888-888888888802'),
('dddddddd-dddd-dddd-dddd-dddddddddd03', '22222222-2222-2222-2222-222222222225', 'Booking Confirmed', 'Your booking for Conference Room B2 (AF-0999) has been confirmed.', 'BOOKING_CONFIRMED', FALSE, 'resource_bookings', '77777777-7777-7777-7777-777777777701');

-- 14. Seed Activity Logs
INSERT INTO activity_logs (user_id, action, target_table, target_id, previous_values, new_values) VALUES
('22222222-2222-2222-2222-222222222222', 'REGISTER_ASSET', 'assets', '44444444-4444-4444-4444-444444444411', NULL, '{"name": "Dell Latitude 5420", "asset_tag": "AF-0012", "status": "AVAILABLE"}'::jsonb),
('22222222-2222-2222-2222-222222222222', 'ALLOCATE_ASSET', 'asset_allocations', '55555555-5555-5555-5555-555555555502', NULL, '{"asset_tag": "AF-0012", "user": "Priya Shah", "status": "ACTIVE"}'::jsonb),
('22222222-2222-2222-2222-222222222225', 'BOOK_RESOURCE', 'resource_bookings', '77777777-7777-7777-7777-777777777701', NULL, '{"resource": "Conference Room B2", "timeslot": "9:00 - 10:00"}'::jsonb);
