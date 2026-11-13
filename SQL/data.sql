-- =====================================================================
-- SAMPLE / TEST DATA - for development and demos ONLY. NEVER load in production.
-- Must run AFTER init.sql, which already inserts the reference rows (ticket
-- statuses, payment statuses, roles + permissions, categories, plans, ban
-- tiers). This file must NOT re-insert them; it references those IDs instead.
--
-- Every seeded account uses password: Password123  (bcrypt hash verified
-- with bcryptjs — the old seed's hash did not match any known password).
-- All dates use Bangkok time, same as the app.
-- Ticket numbers follow the app's own format A001, A002... restarting per
-- shop queue per day (see TicketModel.nextQueueNumber).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) OWNERS — six demo owners (role set inline so login works immediately)
-- ---------------------------------------------------------------------
INSERT INTO owner (fname, lname, phone_number, email, password, role_ID) VALUES
('Somchai',   'Rattanakorn',   '0812345678',  'somchai.rattanakorn@example.com', '$2b$10$ORrGhTRePhQt5HsMu.KmDumVJRQxo7.NZN99OuixVqZX4ANViLWPG', (SELECT role_id FROM role WHERE role_name = 'owner')),
('Anong',     'Chaiyaporn',    '0898765432',  'anong.chaiyaporn@example.com',    '$2b$10$ORrGhTRePhQt5HsMu.KmDumVJRQxo7.NZN99OuixVqZX4ANViLWPG', (SELECT role_id FROM role WHERE role_name = 'owner')),
('Kittipong', 'Srisuwan',      '0865554321',  'kittipong.srisuwan@example.com',  '$2b$10$ORrGhTRePhQt5HsMu.KmDumVJRQxo7.NZN99OuixVqZX4ANViLWPG', (SELECT role_id FROM role WHERE role_name = 'owner')),
('Malee',     'Phongsaphan',   '0933111223',  'malee.phongsaphan@example.com',   '$2b$10$ORrGhTRePhQt5HsMu.KmDumVJRQxo7.NZN99OuixVqZX4ANViLWPG', (SELECT role_id FROM role WHERE role_name = 'owner')),
('Piyarat',   'Suthasena',     '0944222334',  'piyarat.suthasena@example.com',   '$2b$10$ORrGhTRePhQt5HsMu.KmDumVJRQxo7.NZN99OuixVqZX4ANViLWPG', (SELECT role_id FROM role WHERE role_name = 'owner')),
('Chaiyasit', 'Boonmee',       '0955333445',  'chaiyasit.boonmee@example.com',   '$2b$10$ORrGhTRePhQt5HsMu.KmDumVJRQxo7.NZN99OuixVqZX4ANViLWPG', (SELECT role_id FROM role WHERE role_name = 'owner'));

-- ---------------------------------------------------------------------
-- 2) BUSINESSES — ten shops. business_id order matters for the INSERTs below:
--    id | name                          owner | queue_type          deposit
--     1 | Siam Fade Barbershop           #1   | timeslot            yes, 100
--     2 | Bright Smile Dental Clinic     #2   | timeslot            no
--     3 | Khao San Roastery & Coffee Bar #3   | walkin 08:00-20:00  no
--     4 | Rattana Quick Barber           #1   | walkin 09:00-21:00  no
--     5 | Sukhumvit Beauty Salon         #4   | timeslot            yes, 150
--     6 | Baan Pet Clinic                #5   | timeslot            no
--     7 | Laptop Lab Bangkok             #5   | walkin 10:00-18:00  yes, 100
--        -> subscription still PENDING: hidden from customers until first payment
--     8 | Amphoe Thai Kitchen            #6   | walkin 11:00-21:00  no (free trial)
--     9 | Chillout Spa & Massage         #6   | walkin 13:00-20:00  no
--    10 | Old Town Barbershop            #4   | closed (is_active=FALSE, sub EXPIRED)
-- ---------------------------------------------------------------------
INSERT INTO business (business_name, description, image, queue_type, is_deposit, deposit_amount, walkin_open_time, walkin_close_time, cancel_before_minutes, owner_id, category_id) VALUES
('Siam Fade Barbershop', 'Premium barbershop in the heart of Siam Square. Skin fades, scissor cuts, beard trims and hot-towel shaves.', '/uploads/business/default-business.jpg', 'timeslot', TRUE, 100.00, NULL, NULL, 60, 1, 1),
('Bright Smile Dental Clinic', 'Modern dental clinic in Chatuchak. Cleanings, whitening, implants and care for children.', '/uploads/business/default-business.jpg', 'timeslot', FALSE, 0.00, NULL, NULL, 60, 2, 2),
('Khao San Roastery & Coffee Bar', 'Small-batch roaster and coffee bar on Khao San Road. Single origins, flat whites and fresh pastries.', '/uploads/business/default-business.jpg', 'walkin', FALSE, 0.00, '08:00', '20:00', 60, 3, 3),
('Rattana Quick Barber', 'Fast, affordable walk-in barber near Rattanakosin road. Cut plus finish in under an hour.', '/uploads/business/default-business.jpg', 'walkin', FALSE, 0.00, '09:00', '21:00', 30, 1, 1),
('Sukhumvit Beauty Salon', 'Full-service salon on Sukhumvit road. Hair, nails, skincare and makeup by licensed stylists.', '/uploads/business/default-business.jpg', 'timeslot', TRUE, 150.00, NULL, NULL, 60, 4, 7),
('Baan Pet Clinic', 'Vet clinic for dogs and cats. Wellness checks, vaccinations, dental care and grooming.', '/uploads/business/default-business.jpg', 'timeslot', FALSE, 0.00, NULL, NULL, 60, 5, 13),
('Laptop Lab Bangkok', 'Laptop and phone repair lab in Silom. Same-day repairs with a 90-day warranty.', '/uploads/business/default-business.jpg', 'walkin', TRUE, 100.00, '10:00', '18:00', 60, 5, 11),
('Amphoe Thai Kitchen', 'Family-run restaurant in Thong Lo serving home-style Thai dishes and weekend buffets.', '/uploads/business/default-business.jpg', 'walkin', FALSE, 0.00, '11:00', '21:00', 60, 6, 4),
('Chillout Spa & Massage', 'Traditional Thai massage and spa on Phahonyothin road. One-hour sessions, walk-in only.', '/uploads/business/default-business.jpg', 'walkin', FALSE, 0.00, '13:00', '20:00', 60, 6, 9),
('Old Town Barbershop', 'Classic old-town barbership, temporarily closed while the shop is being refurbished.', '/uploads/business/default-business.jpg', 'walkin', FALSE, 0.00, '09:00', '18:00', 60, 4, 1);

-- ---------------------------------------------------------------------
-- 3) SUBSCRIPTIONS — mix of plans and states so every app path is covered:
--    Active Basic/Pro, Free Trial, Pending (new shop not yet visible to
--    customers), and Expired (closed shop).
-- ---------------------------------------------------------------------
INSERT INTO subscription (start_date, end_date, business_id, plan_id, substatus_id) VALUES
((NOW() AT TIME ZONE 'Asia/Bangkok')::date,            (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 30, 1, 2, 1),   -- Siam Fade: Basic, active
((NOW() AT TIME ZONE 'Asia/Bangkok')::date,            (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 90, 2, 3, 1),   -- Bright Smile: Pro, active
((NOW() AT TIME ZONE 'Asia/Bangkok')::date,            (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 14, 3, 1, 1),   -- Khao San Roastery: free trial
((NOW() AT TIME ZONE 'Asia/Bangkok')::date,            (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 60, 4, 2, 1),   -- Rattana Quick Barber: Basic, active
((NOW() AT TIME ZONE 'Asia/Bangkok')::date,            (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 45, 5, 2, 1),   -- Sukhumvit Beauty Salon: Basic, active
((NOW() AT TIME ZONE 'Asia/Bangkok')::date,            (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 14, 6, 1, 1),   -- Baan Pet Clinic: free trial
-- Laptop Lab is a brand-new shop: Pending, same shape as subscriptionModel.createPending
((NOW() AT TIME ZONE 'Asia/Bangkok')::date,            (NOW() AT TIME ZONE 'Asia/Bangkok')::date,        7, 2, 4),   -- PENDING
((NOW() AT TIME ZONE 'Asia/Bangkok')::date,            (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 14, 8, 1, 1),   -- Amphoe Thai Kitchen: free trial
((NOW() AT TIME ZONE 'Asia/Bangkok')::date,            (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 60, 9, 2, 1),   -- Chillout Spa: Basic, active
-- Old Town Barbershop lapsed a month ago
((NOW() AT TIME ZONE 'Asia/Bangkok')::date - 90,       (NOW() AT TIME ZONE 'Asia/Bangkok')::date - 60, 10, 2, 2);   -- EXPIRED

-- Payment history for the shops that have actually paid (demo references).
INSERT INTO subscription_payment (amount, paid_at, reference, period_start, period_end, subscription_id) VALUES
(990.00,   NOW() - interval '5 days',    'BK-0001', (NOW() AT TIME ZONE 'Asia/Bangkok')::date,          (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 30, (SELECT subscription_id FROM subscription WHERE business_id = 1)),
(2590.00,  NOW() - interval '12 days',   'BK-0002', (NOW() AT TIME ZONE 'Asia/Bangkok')::date,          (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 90, (SELECT subscription_id FROM subscription WHERE business_id = 2)),
(990.00,   NOW() - interval '3 days',    'BK-0003', (NOW() AT TIME ZONE 'Asia/Bangkok')::date,          (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 60, (SELECT subscription_id FROM subscription WHERE business_id = 4)),
(990.00,   NOW() - interval '8 days',    'BK-0004', (NOW() AT TIME ZONE 'Asia/Bangkok')::date,          (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 45, (SELECT subscription_id FROM subscription WHERE business_id = 5)),
(990.00,   NOW() - interval '20 days',   'BK-0005', (NOW() AT TIME ZONE 'Asia/Bangkok')::date,          (NOW() AT TIME ZONE 'Asia/Bangkok')::date + 60, (SELECT subscription_id FROM subscription WHERE business_id = 9)),
-- the old payment behind Old Town Barbershop's expired plan
(990.00,   NOW() - interval '85 days',   'BK-0006', (NOW() AT TIME ZONE 'Asia/Bangkok')::date - 90,    (NOW() AT TIME ZONE 'Asia/Bangkok')::date - 60, (SELECT subscription_id FROM subscription WHERE business_id = 10));

-- ---------------------------------------------------------------------
-- 4) TODAY'S QUEUES — only pre-seeded for the shops that already have
--    tickets below; the app auto-creates queue rows on demand for the rest.
-- ---------------------------------------------------------------------
INSERT INTO queue (date, business_id) VALUES
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, 1),   -- Siam Fade Barbershop
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, 2),   -- Bright Smile Dental Clinic
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, 3),   -- Khao San Roastery & Coffee Bar
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, 4),   -- Rattana Quick Barber
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, 5),   -- Sukhumvit Beauty Salon
((NOW() AT TIME ZONE 'Asia/Bangkok')::date, 6);   -- Baan Pet Clinic

-- ---------------------------------------------------------------------
-- 5) TIME SLOTS — the next 14 days (today .. today+13), same as
--    BusinessModel.addTimeSlots generates for timeslot shops.
-- ---------------------------------------------------------------------
INSERT INTO time_slot (business_id, date, start_time, end_time, max_capacity)
SELECT v.bid, (NOW() AT TIME ZONE 'Asia/Bangkok')::date + s.n, v.st, v.et, v.cap
FROM (VALUES
  (1, '10:00'::time, '11:00'::time, 3),   -- Siam Fade Barbershop
  (1, '13:00'::time, '14:00'::time, 3),
  (2, '09:00'::time, '10:00'::time, 2),   -- Bright Smile Dental Clinic
  (2, '14:00'::time, '15:00'::time, 2),
  (5, '10:00'::time, '11:00'::time, 2),   -- Sukhumvit Beauty Salon
  (5, '13:00'::time, '14:00'::time, 2),
  (6, '09:00'::time, '10:00'::time, 2),   -- Baan Pet Clinic
  (6, '16:00'::time, '17:00'::time, 2)
) AS v(bid, st, et, cap)
CROSS JOIN generate_series(0, 13) AS s(n);

-- ---------------------------------------------------------------------
-- 6) CUSTOMERS — eight demo customers (a couple with email opt-ins enabled).
-- ---------------------------------------------------------------------
INSERT INTO customer (fname, lname, phone_number, email, password, role_ID, email_notifications_opt_in, daily_email_hour, queue_reminder_opt_in, reminder_hours_before) VALUES
('Natthapol', 'Srichai',     '0917123456', 'natthapol.srichai@example.com',     '$2b$10$ORrGhTRePhQt5HsMu.KmDumVJRQxo7.NZN99OuixVqZX4ANViLWPG', (SELECT role_id FROM role WHERE role_name = 'customer'), TRUE,  7, FALSE, 1),
('Pimchanok', 'Wilaiphol',   '0918765432', 'pimchanok.wilaiphol@example.com',   '$2b$10$ORrGhTRePhQt5HsMu.KmDumVJRQxo7.NZN99OuixVqZX4ANViLWPG', (SELECT role_id FROM role WHERE role_name = 'customer'), FALSE, 8, FALSE, 1),
('Thongchai', 'Maneenon',    '0919876543', 'thongchai.maneenon@example.com',    '$2b$10$ORrGhTRePhQt5HsMu.KmDumVJRQxo7.NZN99OuixVqZX4ANViLWPG', (SELECT role_id FROM role WHERE role_name = 'customer'), FALSE, 8, FALSE, 1),
('Warit',     'Suthasani',   '0920111223', 'warit.suthasani@example.com',       '$2b$10$ORrGhTRePhQt5HsMu.KmDumVJRQxo7.NZN99OuixVqZX4ANViLWPG', (SELECT role_id FROM role WHERE role_name = 'customer'), FALSE, 8, TRUE,  2),
('Kanchana',  'Rungsi',      '0921333445', 'kanchana.rungsi@example.com',       '$2b$10$ORrGhTRePhQt5HsMu.KmDumVJRQxo7.NZN99OuixVqZX4ANViLWPG', (SELECT role_id FROM role WHERE role_name = 'customer'), FALSE, 8, FALSE, 1),
('Ekarat',    'Thongdee',    '0922555667', 'ekarat.thongdee@example.com',       '$2b$10$ORrGhTRePhQt5HsMu.KmDumVJRQxo7.NZN99OuixVqZX4ANViLWPG', (SELECT role_id FROM role WHERE role_name = 'customer'), FALSE, 8, FALSE, 1),
('Sira',      'Pannasarn',   '0923444556', 'sira.pannasarn@example.com',        '$2b$10$ORrGhTRePhQt5HsMu.KmDumVJRQxo7.NZN99OuixVqZX4ANViLWPG', (SELECT role_id FROM role WHERE role_name = 'customer'), FALSE, 8, FALSE, 1),
('Benjaporn', 'Srisutha',    '0924666778', 'benjaporn.srisutha@example.com',    '$2b$10$ORrGhTRePhQt5HsMu.KmDumVJRQxo7.NZN99OuixVqZX4ANViLWPG', (SELECT role_id FROM role WHERE role_name = 'customer'), FALSE, 8, FALSE, 1);

-- ---------------------------------------------------------------------
-- 7) TODAY'S TICKETS — mixed statuses across all shop types.
--    Active tickets: Waiting / Serving / Completed.
--      * timeslot bookings are joined to their slot (capacity respected),
--      * walk-in tickets have timeslot_id = NULL and pax = 1, one per
--        customer/shop/day inside the walkin hours.
-- ---------------------------------------------------------------------
INSERT INTO ticket (queue_number, queue_id, timeslot_id, customer_id, status_id, pax)
SELECT v.qn, q.queue_id, ts.timeslot_id, v.cid, v.st, v.pax
FROM (VALUES
  -- Shop 1 Siam Fade Barbershop (timeslot + deposit shop)
  ('A001', 1, '10:00'::time, 1, 3, 2),   -- Natthapol: morning slot done (slot full with A002)
  ('A002', 1, '10:00'::time, 7, 1, 1),   -- Sira: waiting in the same slot
  ('A003', 1, '13:00'::time, 8, 1, 1),   -- Benjaporn: afternoon slot booked
  -- Shop 2 Bright Smile Dental Clinic (timeslot)
  ('A001', 2, '09:00'::time, 3, 3, 1),   -- Thongchai: morning visit done
  ('A002', 2, '14:00'::time, 5, 1, 1),   -- Kanchana: waiting for afternoon slot
  -- Shop 3 Khao San Roastery & Coffee Bar (walk-in)
  ('A001', 3, NULL::time,    2, 2, 1),   -- Pimchanok: being served now
  ('A002', 3, NULL::time,    4, 1, 1),   -- Warit: waiting in line
  -- Shop 4 Rattana Quick Barber (walk-in)
  ('A001', 4, NULL::time,    5, 2, 1),   -- Kanchana: being served now
  ('A002', 4, NULL::time,    6, 1, 1),   -- Ekarat: waiting in line
  -- Shop 5 Sukhumvit Beauty Salon (timeslot + deposit shop)
  ('A001', 5, '10:00'::time, 6, 2, 2),   -- Ekarat + friend: being served now (slot full)
  ('A002', 5, '13:00'::time, 7, 1, 2),   -- Sira + friend: afternoon slot booked
  -- Shop 6 Baan Pet Clinic (timeslot)
  ('A001', 6, '09:00'::time, 2, 3, 1),   -- Pimchanok's dog: morning check done
  ('A002', 6, '16:00'::time, 4, 1, 1)    -- Warit: late slot booked
) AS v(qn, bid, stime, cid, st, pax)
JOIN queue q ON q.business_id = v.bid AND q.date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date
LEFT JOIN time_slot ts ON ts.business_id = v.bid
    AND ts.date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date
    AND ts.start_time = v.stime;

-- Today's cancelled tickets: one customer self-cancellation (deposit refunded)
-- and one no-show at a walk-in shop.
INSERT INTO ticket (queue_number, queue_id, timeslot_id, customer_id, status_id, pax, cancelled_at, cancelled_by) VALUES
('A004',
  (SELECT queue_id FROM queue WHERE business_id = 1 AND date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date),
  (SELECT timeslot_id FROM time_slot WHERE business_id = 1 AND date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date AND start_time = '13:00'),
  3, 4, 2, NOW() - interval '6 hours', 'customer'),   -- Thongchai cancelled his own Siam Fade slot before the cutoff
('A003',
  (SELECT queue_id FROM queue WHERE business_id = 3 AND date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date),
  NULL,
  8, 4, 1, NOW() - interval '20 minutes', 'no_show'); -- Benjaporn never showed up at Khao San Roastery

-- Deposit payments: tickets at deposit shops have their deposit recorded as Paid
-- when the booking is made; self-cancellation then flips it to Refunded,
-- while no-shows keep their deposit.
INSERT INTO payment (ticket_id, amount, status_id)
SELECT t.ticket_id, b.deposit_amount, 2
FROM ticket t
JOIN queue q ON q.queue_id = t.queue_id
JOIN business b ON b.business_id = q.business_id AND b.is_deposit = TRUE;

UPDATE payment SET status_id = 3
WHERE ticket_id IN (SELECT ticket_id FROM ticket WHERE status_id = 4);

-- A few customer notifications tied to today's tickets.
INSERT INTO notification (message, ticket_id, customer_id)
SELECT v.msg, t.ticket_id, t.customer_id
FROM (VALUES
  ('You are next in line at Khao San Roastery & Coffee Bar - your ticket is A002.', 3, 'A002'),
  ('Your appointment at Sukhumvit Beauty Salon starts at 10:00 today (ticket A001).', 5, 'A001'),
  ('Reminder: your Siam Fade Barbershop booking is today at 13:00 (ticket A003).', 1, 'A003')
) AS v(msg, bid, qn)
JOIN queue q ON q.business_id = v.bid AND q.date = (NOW() AT TIME ZONE 'Asia/Bangkok')::date
JOIN ticket t ON t.queue_id = q.queue_id AND t.queue_number = v.qn;

-- Benjaporn's no-show earned a 30-minute Warning ban (tier 1).
INSERT INTO blacklist (customer_id, tier_id) VALUES (8, 1);
