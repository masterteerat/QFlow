-- Seed data. Runs after init.sql.

INSERT INTO ticket_status (status_name) VALUES
('Waiting'),
('Serving'),
('Completed'),
('Cancelled');

INSERT INTO payment_status (status_name) VALUES
('Unpaid'),
('Paid'),
('Refunded');

INSERT INTO subscription_plan (plan_name, description, price) VALUES
('Free Trial', '14-day trial, limited to 50 queues/day', 0.00),
('Basic Plan', 'Unlimited queues for small businesses', 990.00),
('Pro Plan', 'Enterprise plan with SMS notifications', 2590.00);

INSERT INTO subscription_status (substatus_name) VALUES
('Active'),
('Expired'),
('Suspended');

INSERT INTO category (name) VALUES
('Barber Shop'),
('Dental Clinic'),
('Cafe & Bar'),
('Restaurant'),
('Pharmacy'),
('Retail'),
('Salon'),
('Medical Clinic'),
('Beauty & Spa'),
('Fitness'),
-- Additional categories for search/filter testing
('Tech Repair'),
('Food & Beverage'),
('Pet Care'),
('Fashion & Clothing'),
('Auto Service');

INSERT INTO owner (fname, lname, phone_number, email, password) VALUES
('John', 'Doe', '0812345678', 'john@example.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'),
('Sarah', 'Smith', '0898765432', 'sarah@example.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'),
('Mike', 'Wilson', '0865554321', 'mike@example.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'),
-- Additional owners for search/filter testing
('Admin', 'Owner', '09331112233', 'admin@qflow.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'),
('Business', 'Owner', '09442223344', 'owner@qflow.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'),
('Shop', 'Manager', '09553334455', 'manager@qflow.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW');

-- business_id order (matters below): 1 Johns Barber, 2 Sarah Dental, 3 Johns Cafe,
-- 4 Mikes Walk-in Barber, 5 Tech Repair Shop, 6 Beauty Salon Pro, 7 Food Express,
-- 8 Auto Service Center, 9 Fashion Hub, 10 Pet Care Clinic.
-- Mike's Walk-in Barber (id 4) has no time slots on purpose -> treated as walk-in.
INSERT INTO business (business_name, is_deposit, deposit_amount, owner_id, category_id) VALUES
('Johns Barber Shop (Siam Branch)', TRUE, 100.00, 1, 1),
('Sarah Dental Clinic', FALSE, 0.00, 2, 2),
('Johns Cafe & Bar', TRUE, 50.00, 1, 3),
('Mikes Walk-in Barber', FALSE, 0.00, 3, 1),
-- Additional businesses for search/filter testing
('Tech Repair Shop', TRUE, 50.00, 4, 11),
('Beauty Salon Pro', FALSE, 0.00, 5, 9),
('Food Express', FALSE, 0.00, 6, 12),
('Auto Service Center', TRUE, 75.00, 4, 15),
('Fashion Hub', TRUE, 25.00, 5, 14),
('Pet Care Clinic', TRUE, 30.00, 6, 13);

INSERT INTO subscription (start_date, end_date, business_id, plan_id, substatus_id) VALUES
(CURRENT_DATE, CURRENT_DATE + 30, 1, 2, 1),
(CURRENT_DATE, CURRENT_DATE + 180, 2, 3, 1),
(CURRENT_DATE, CURRENT_DATE + 14, 3, 1, 1),
(CURRENT_DATE, CURRENT_DATE + 180, 4, 2, 1),
(CURRENT_DATE, CURRENT_DATE + 180, 5, 2, 1),
(CURRENT_DATE, CURRENT_DATE + 180, 6, 2, 1);

-- Today's queue row for each business (the app would auto-create these on first
-- booking anyway via findOrCreateTodayQueue, but they're pre-seeded here so the
-- TEST QUEUE TICKETS below have something to attach to).
INSERT INTO queue (date, business_id) VALUES
(CURRENT_DATE, 1),
(CURRENT_DATE, 2),
(CURRENT_DATE, 3),
(CURRENT_DATE, 4),
(CURRENT_DATE, 5),
(CURRENT_DATE, 6);

-- Time slots, stamped across a rolling 14-day window (CURRENT_DATE .. CURRENT_DATE + 13),
-- exactly like BusinessModel.addTimeSlots does when an owner registers a shop through the
-- app. This is the actual fix: the old version hardcoded '2026-07-29', which silently
-- fell outside businessModel.findAllWithSlots' 14-day visibility window once that date
-- was in the past, making these shops look like walk-in-only on the customer home page.
-- max_capacity is set explicitly here (5) since the column defaults to 1, which would make
-- every slot "fully booked" after a single ticket - too restrictive for demo/testing data.

-- Business 1: Johns Barber Shop (Siam Branch)
INSERT INTO time_slot (date, start_time, end_time, max_capacity, business_id)
SELECT CURRENT_DATE + day_offset, v.start_t, v.end_t, 5, 1
FROM generate_series(0, 13) AS day_offset
CROSS JOIN (VALUES
  ('10:00'::time, '11:00'::time),
  ('11:00'::time, '12:00'::time),
  ('13:00'::time, '14:00'::time)
) AS v(start_t, end_t);

-- Business 2: Sarah Dental Clinic
INSERT INTO time_slot (date, start_time, end_time, max_capacity, business_id)
SELECT CURRENT_DATE + day_offset, v.start_t, v.end_t, 5, 2
FROM generate_series(0, 13) AS day_offset
CROSS JOIN (VALUES
  ('09:00'::time, '10:00'::time),
  ('14:00'::time, '15:00'::time)
) AS v(start_t, end_t);

-- Business 3: Johns Cafe & Bar
INSERT INTO time_slot (date, start_time, end_time, max_capacity, business_id)
SELECT CURRENT_DATE + day_offset, v.start_t, v.end_t, 5, 3
FROM generate_series(0, 13) AS day_offset
CROSS JOIN (VALUES
  ('12:00'::time, '13:00'::time),
  ('18:00'::time, '19:00'::time)
) AS v(start_t, end_t);

-- Business 5: Tech Repair Shop (comment in the old file mislabeled this as
-- "Beauty Salon Pro" - business_id 5 is actually Tech Repair Shop; see the
-- business_id order note above)
INSERT INTO time_slot (date, start_time, end_time, max_capacity, business_id)
SELECT CURRENT_DATE + day_offset, v.start_t, v.end_t, 5, 5
FROM generate_series(0, 13) AS day_offset
CROSS JOIN (VALUES
  ('10:00'::time, '11:00'::time),
  ('14:00'::time, '15:00'::time)
) AS v(start_t, end_t);

-- Business 6: Beauty Salon Pro (old file mislabeled this slot block as
-- "Pet Care Clinic" - business_id 6 is actually Beauty Salon Pro)
INSERT INTO time_slot (date, start_time, end_time, max_capacity, business_id)
SELECT CURRENT_DATE + day_offset, v.start_t, v.end_t, 5, 6
FROM generate_series(0, 13) AS day_offset
CROSS JOIN (VALUES
  ('10:00'::time, '11:00'::time),
  ('14:00'::time, '15:00'::time)
) AS v(start_t, end_t);

-- ====================
-- TEST CUSTOMERS
-- ====================
-- Password for all: password123
INSERT INTO customer (fname, lname, phone_number, email, password) VALUES
('John', 'Doe', '09171234567', 'john@qflow.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'),
('Jane', 'Smith', '09187654321', 'jane@qflow.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'),
('Mike', 'Johnson', '09198765432', 'mike@qflow.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'),
('Sarah', 'Williams', '09201112233', 'sarah@qflow.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'),
('Alex', 'Brown', '09213334455', 'alex@qflow.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'),
('Emily', 'Davis', '09225556677', 'emily@qflow.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW');

-- ====================
-- TEST QUEUE TICKETS
-- ====================
-- timeslot_id values are resolved with a subquery against (business_id, date, start_time)
-- instead of hardcoded integers. The old version hardcoded IDs like 1, 3, 6, 8, which
-- pointed at the WRONG business's slot in a couple of rows (e.g. a ticket queued under
-- business 2 referenced a time_slot row that actually belonged to business 1) - a
-- leftover mismatch from when the slot rows were renumbered. Subqueries make this
-- self-correcting regardless of row order/count.
INSERT INTO ticket (queue_number, queue_id, timeslot_id, customer_id, status_id) VALUES
('Q-001', 1, NULL, 1, 1),
('Q-002', 1, (SELECT timeslot_id FROM time_slot WHERE business_id = 1 AND date = CURRENT_DATE AND start_time = '10:00:00'), 2, 1),
('Q-003', 1, NULL, 3, 2),
('Q-004', 2, (SELECT timeslot_id FROM time_slot WHERE business_id = 2 AND date = CURRENT_DATE AND start_time = '09:00:00'), 4, 1),
('Q-005', 2, NULL, 5, 1),
('Q-006', 2, NULL, 6, 1),
('Q-007', 3, NULL, 1, 1),
('Q-008', 3, (SELECT timeslot_id FROM time_slot WHERE business_id = 3 AND date = CURRENT_DATE AND start_time = '12:00:00'), 2, 2),
('Q-009', 5, (SELECT timeslot_id FROM time_slot WHERE business_id = 5 AND date = CURRENT_DATE AND start_time = '10:00:00'), 3, 1),
('Q-010', 6, (SELECT timeslot_id FROM time_slot WHERE business_id = 6 AND date = CURRENT_DATE AND start_time = '10:00:00'), 4, 1),
('Q-011', 4, NULL, 5, 1),
('Q-012', 1, NULL, 6, 1);

-- ====================
-- TEST ACCOUNT CREDENTIALS
-- ====================
-- 
-- OWNERS:
--   admin@qflow.com / password123
--   owner@qflow.com / password123
--   manager@qflow.com / password123
--   john@example.com / password123
--   sarah@example.com / password123
--   mike@example.com / password123
--
-- CUSTOMERS:
--   john@qflow.com / password123
--   jane@qflow.com / password123
--   mike@qflow.com / password123
--   sarah@qflow.com / password123
--   alex@qflow.com / password123
--   emily@qflow.com / password123
--
-- ====================
-- SEARCH & FILTER TEST DATA
-- ====================
-- 
-- Businesses WITH deposit:
--   Johns Barber Shop (Siam Branch) - 100.00
--   Johns Cafe & Bar - 50.00
--   Tech Repair Shop - 50.00
--   Auto Service Center - 75.00
--   Fashion Hub - 25.00
--   Pet Care Clinic - 30.00
--
-- Businesses WITH NO deposit:
--   Sarah Dental Clinic - 0.00
--   Mikes Walk-in Barber - 0.00
--   Beauty Salon Pro - 0.00
--   Food Express - 0.00
--
-- Search keywords to test:
--   "Tech" -> Tech Repair Shop
--   "Beauty" -> Beauty Salon Pro
--   "Food" -> Food Express
--   "Auto" -> Auto Service Center
--   "Fashion" -> Fashion Hub
--   "Pet" -> Pet Care Clinic
--   "repair" -> Tech Repair Shop, Auto Service Center
--   "barber" -> Johns Barber Shop, Mikes Walk-in Barber
--   "dental" -> Sarah Dental Clinic