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

INSERT INTO owner (fname, lname, phone_number, email, password) VALUES
('John', 'Doe', '0812345678', 'john@example.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'),
('Sarah', 'Smith', '0898765432', 'sarah@example.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'),
('Mike', 'Wilson', '0865554321', 'mike@example.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW');

-- Mike's Walk-in Barber (id 4) has no time slots on purpose -> treated as walk-in.
INSERT INTO business (business_name, is_deposit, deposit_amount, owner_id) VALUES
('Johns Barber Shop (Siam Branch)', TRUE, 100.00, 1),
('Sarah Dental Clinic', FALSE, 0.00, 2),
('Johns Cafe & Bar', TRUE, 50.00, 1),
('Mikes Walk-in Barber', FALSE, 0.00, 3);

INSERT INTO subscription (start_date, end_date, business_id, plan_id, substatus_id) VALUES
('2026-07-01', '2026-07-31', 1, 2, 1),
('2026-07-01', '2026-12-31', 2, 3, 1),
('2026-07-15', '2026-07-29', 3, 1, 1),
('2026-07-01', '2026-12-31', 4, 2, 1);

INSERT INTO time_slot (date, start_time, end_time, business_id) VALUES
('2026-07-29', '10:00:00', '11:00:00', 1),
('2026-07-29', '11:00:00', '12:00:00', 1),
('2026-07-29', '13:00:00', '14:00:00', 1),
('2026-07-29', '09:00:00', '10:00:00', 2),
('2026-07-29', '14:00:00', '15:00:00', 2),
('2026-07-29', '12:00:00', '13:00:00', 3),
('2026-07-29', '18:00:00', '19:00:00', 3);
