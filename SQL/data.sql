-- =====================================================================
-- SAMPLE / TEST DATA - for development and demos ONLY. NEVER load in production.
-- Must run AFTER init.sql (which already inserts statuses, roles, permissions,
-- categories, plans and ban tiers). All seeded accounts use password: Password123
-- All dates use Bangkok time, same as the app.
--
-- Ticket numbers follow the app's own format: A001, A002, ... restarting at A001
-- for each shop's queue each day (see TicketModel.nextQueueNumber).
-- =====================================================================

-- Seed owners
INSERT INTO owner (fname, lname, phone_number, email, password) VALUES
('John', 'Doe', '0812345678', 'john@example.com', '$2b$10$Bp/Zt9jcOi3nfJbiEcwUjezAMByR1wpMc7QHxwjEjQM4kdb2Jtavy'),
('Sarah', 'Smith', '0898765432', 'sarah@example.com', '$2b$10$Bp/Zt9jcOi3nfJbiEcwUjezAMByR1wpMc7QHxwjEjQM4kdb2Jtavy'),
('Mike', 'Wilson', '0865554321', 'mike@example.com', '$2b$10$Bp/Zt9jcOi3nfJbiEcwUjezAMByR1wpMc7QHxwjEjQM4kdb2Jtavy'),
-- Additional owners for search/filter testing
('Admin', 'Owner', '09331112233', 'admin@qflow.com', '$2b$10$Bp/Zt9jcOi3nfJbiEcwUjezAMByR1wpMc7QHxwjEjQM4kdb2Jtavy'),
('Business', 'Owner', '09442223344', 'owner@qflow.com', '$2b$10$Bp/Zt9jcOi3nfJbiEcwUjezAMByR1wpMc7QHxwjEjQM4kdb2Jtavy'),
('Shop', 'Manager', '09553334455', 'manager@qflow.com', '$2b$10$Bp/Zt9jcOi3nfJbiEcwUjezAMByR1wpMc7QHxwjEjQM4kdb2Jtavy');

-- business_id order (matters below): 1 Johns Barber, 2 Sarah Dental, 3 Johns Cafe,
-- 4 Mikes Walk-in Barber, 5 Tech Repair Shop, 6 Beauty Salon Pro, 7 Food Express,
-- 8 Auto Service Center, 9 Fashion Hub, 10 Pet Care Clinic.
-- Mike's Walk-in Barber (id 4) has no time slots on purpose -> treated as walk-in.
INSERT INTO business (business_name, description, image, is_deposit, deposit_amount, owner_id, category_id) VALUES
('Johns Barber Shop (Siam Branch)', 'Premium barber services in the heart of Siam. Offering haircuts, fades, and styling for all ages.', '/uploads/business/default-business.jpg', TRUE, 100.00, 1, 1),
('Sarah Dental Clinic', 'Expert dental care with modern equipment. Specializing in cosmetic dentistry and preventive care.', '/uploads/business/default-business.jpg', FALSE, 0.00, 2, 2),
('Johns Cafe & Bar', 'Cozy cafe and bar serving specialty coffee, fresh pastries, and craft cocktails in a relaxed atmosphere.', '/uploads/business/default-business.jpg', TRUE, 50.00, 1, 3),
('Mikes Walk-in Barber', 'Quick and affordable walk-in barber shop. No appointment needed, just walk in and get styled.', '/uploads/business/default-business.jpg', FALSE, 0.00, 3, 1),
-- Additional businesses for search/filter testing
('Tech Repair Shop', 'Professional tech repair services for phones, laptops, and tablets. Fast turnaround guaranteed.', '/uploads/business/default-business.jpg', TRUE, 50.00, 4, 11),
('Beauty Salon Pro', 'Full-service beauty salon offering hair, nails, skincare, and makeup services by licensed professionals.', '/uploads/business/default-business.jpg', FALSE, 0.00, 5, 9),
('Food Express', 'Fast and delicious food delivery. Wide variety of cuisines delivered straight to your door.', '/uploads/business/default-business.jpg', FALSE, 0.00, 6, 12),
('Auto Service Center', 'Trusted auto repair and maintenance center. Oil changes, brakes, engines, and more.', '/uploads/business/default-business.jpg', TRUE, 75.00, 4, 15),
('Fashion Hub', 'Trendy fashion store with the latest clothing, accessories, and footwear for men and women.', '/uploads/business/default-business.jpg', TRUE, 25.00, 5, 14),
('Pet Care Clinic', 'Full-service veterinary clinic offering wellness exams, vaccinations, and surgical care for pets.', '/uploads/business/default-business.jpg', TRUE, 30.00, 6, 13);

INSERT INTO subscription (start_date, end_date, business_id, plan_id, substatus_id) VALUES
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 30, 1, 2, 1),
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 180, 2, 3, 1),
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 14, 3, 1, 1),
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 180, 4, 2, 1),
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 180, 5, 2, 1),
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 180, 6, 2, 1);

-- Today's queue row for each business (the app would auto-create these on first
-- booking anyway via findOrCreateTodayQueue, but they're pre-seeded here so the
-- TEST QUEUE TICKETS below have something to attach to).
INSERT INTO queue (date, business_id) VALUES
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, 1),
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, 2),
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, 3),
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, 4),
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, 5),
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, 6);

-- Time slots, stamped across a rolling 14-day window ((NOW() AT TIME ZONE 'Asia/Bangkok')::date .. (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 13),
-- exactly like BusinessModel.addTimeSlots does when an owner registers a shop through the
-- app. This is the actual fix: the old version hardcoded '2026-07-29', which silently
-- fell outside businessModel.findAllWithSlots' 14-day visibility window once that date
-- was in the past, making these shops look like walk-in-only on the customer home page.
-- max_capacity is set explicitly here (5) since the column defaults to 1, which would make
-- every slot "fully booked" after a single ticket - too restrictive for demo/testing data.

-- Business 1: Johns Barber Shop (Siam Branch)
INSERT INTO time_slot (date, start_time, end_time, max_capacity, business_id)
SELECT (NOW() AT TIME ZONE 'Asia/Bangkok')::date + day_offset, v.start_t, v.end_t, 5, 1
FROM generate_series(0, 13) AS day_offset
CROSS JOIN (VALUES
  ('10:00'::time, '11:00'::time),
  ('11:00'::time, '12:00'::time),
  ('13:00'::time, '14:00'::time)
) AS v(start_t, end_t);

-- Business 2: Sarah Dental Clinic
INSERT INTO time_slot (date, start_time, end_time, max_capacity, business_id)
SELECT (NOW() AT TIME ZONE 'Asia/Bangkok')::date + day_offset, v.start_t, v.end_t, 5, 2
FROM generate_series(0, 13) AS day_offset
CROSS JOIN (VALUES
  ('09:00'::time, '10:00'::time),
  ('14:00'::time, '15:00'::time)
) AS v(start_t, end_t);

-- Business 3: Johns Cafe & Bar
INSERT INTO time_slot (date, start_time, end_time, max_capacity, business_id)
SELECT (NOW() AT TIME ZONE 'Asia/Bangkok')::date + day_offset, v.start_t, v.end_t, 5, 3
FROM generate_series(0, 13) AS day_offset
CROSS JOIN (VALUES
  ('12:00'::time, '13:00'::time),
  ('18:00'::time, '19:00'::time)
) AS v(start_t, end_t);

-- Business 5: Tech Repair Shop (comment in the old file mislabeled this as
-- "Beauty Salon Pro" - business_id 5 is actually Tech Repair Shop; see the
-- business_id order note above)
INSERT INTO time_slot (date, start_time, end_time, max_capacity, business_id)
SELECT (NOW() AT TIME ZONE 'Asia/Bangkok')::date + day_offset, v.start_t, v.end_t, 5, 5
FROM generate_series(0, 13) AS day_offset
CROSS JOIN (VALUES
  ('10:00'::time, '11:00'::time),
  ('14:00'::time, '15:00'::time)
) AS v(start_t, end_t);

-- Business 6: Beauty Salon Pro (old file mislabeled this slot block as
-- "Pet Care Clinic" - business_id 6 is actually Beauty Salon Pro)
INSERT INTO time_slot (date, start_time, end_time, max_capacity, business_id)
SELECT (NOW() AT TIME ZONE 'Asia/Bangkok')::date + day_offset, v.start_t, v.end_t, 5, 6
FROM generate_series(0, 13) AS day_offset
CROSS JOIN (VALUES
  ('10:00'::time, '11:00'::time),
  ('14:00'::time, '15:00'::time)
) AS v(start_t, end_t);

UPDATE business SET queue_type = 'timeslot' WHERE business_id IN (SELECT DISTINCT business_id FROM time_slot);

-- ====================
-- TEST CUSTOMERS
-- ====================
-- Password for ALL seeded owners and customers: Password123  (the old hash did not match any known password)
INSERT INTO customer (fname, lname, phone_number, email, password) VALUES
('John', 'Doe', '09171234567', 'john@qflow.com', '$2b$10$Bp/Zt9jcOi3nfJbiEcwUjezAMByR1wpMc7QHxwjEjQM4kdb2Jtavy'),
('Jane', 'Smith', '09187654321', 'jane@qflow.com', '$2b$10$Bp/Zt9jcOi3nfJbiEcwUjezAMByR1wpMc7QHxwjEjQM4kdb2Jtavy'),
('Mike', 'Johnson', '09198765432', 'mike@qflow.com', '$2b$10$Bp/Zt9jcOi3nfJbiEcwUjezAMByR1wpMc7QHxwjEjQM4kdb2Jtavy'),
('Sarah', 'Williams', '09201112233', 'sarah@qflow.com', '$2b$10$Bp/Zt9jcOi3nfJbiEcwUjezAMByR1wpMc7QHxwjEjQM4kdb2Jtavy'),
('Alex', 'Brown', '09213334455', 'alex@qflow.com', '$2b$10$Bp/Zt9jcOi3nfJbiEcwUjezAMByR1wpMc7QHxwjEjQM4kdb2Jtavy'),
('Emily', 'Davis', '09225556677', 'emily@qflow.com', '$2b$10$Bp/Zt9jcOi3nfJbiEcwUjezAMByR1wpMc7QHxwjEjQM4kdb2Jtavy');

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
('A001', 1, NULL, 1, 1),
('A002', 1, (SELECT timeslot_id FROM time_slot WHERE business_id = 1 AND date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date AND start_time = '10:00:00'), 2, 1),
('A003', 1, NULL, 3, 2),
('A004', 1, NULL, 6, 1),
('A001', 2, (SELECT timeslot_id FROM time_slot WHERE business_id = 2 AND date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date AND start_time = '09:00:00'), 4, 1),
('A002', 2, NULL, 5, 1),
('A003', 2, NULL, 6, 1),
('A001', 3, NULL, 1, 1),
('A002', 3, (SELECT timeslot_id FROM time_slot WHERE business_id = 3 AND date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date AND start_time = '12:00:00'), 2, 2),
('A001', 4, NULL, 5, 1),
('A001', 5, (SELECT timeslot_id FROM time_slot WHERE business_id = 5 AND date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date AND start_time = '10:00:00'), 3, 1),
('A001', 6, (SELECT timeslot_id FROM time_slot WHERE business_id = 6 AND date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date AND start_time = '10:00:00'), 4, 1);


-- ========== 5) ผู้ใช้เดิมที่ยังไม่มี role ==========
-- ถ้าไม่ทำ ผู้ใช้เดิมจะได้ 403 ทุก route เพราะไม่มี permission
UPDATE customer SET role_ID = (SELECT role_ID FROM role WHERE role_name = 'customer') WHERE role_ID IS NULL;
UPDATE owner    SET role_ID = (SELECT role_ID FROM role WHERE role_name = 'owner')    WHERE role_ID IS NULL;