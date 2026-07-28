-- =========================================================
-- STEP 1: Master Tables (System Setup)
-- =========================================================
-- 1. Ticket Status
INSERT INTO Ticket_Status (status_name) VALUES 
('Waiting'),
('Serving'),
('Completed'),
('Cancelled');
-- 2. Payment Status
INSERT INTO Payment_Status (status_name) VALUES 
('Unpaid'),
('Paid'),
('Refunded');
-- 3. Subscription Plans
INSERT INTO Subscription_Plan (plan_name, description, price) VALUES 
('Free Trial', '14-day free trial, limited to 50 queues/day', 0.00),
('Basic Plan', 'For small businesses, unlimited queues', 990.00),
('Pro Plan', 'For enterprise, includes SMS notifications', 2590.00);
-- 4. Subscription Status
INSERT INTO Subscription_Status (substatus_name) VALUES 
('Active'),
('Expired'),
('Suspended');
-- STEP 2: Owners Setup
-- 5. Owners
INSERT INTO Owner (fname, lname, phone_number, email, password) VALUES 
('John', 'Doe', '0812345678', 'john@example.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'),
('Sarah', 'Smith', '0898765432', 'sarah@example.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'),
('Mike', 'Wilson', '0865554321', 'mike@example.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW');
-- STEP 3: Business Setup (Linked to Owners)
-- 6. Businesses
INSERT INTO Business (business_name, is_deposit, deposit_amount, owner_id) VALUES 
('Johns Barber Shop (Siam Branch)', TRUE, 100.00, 1),
('Sarah Dental Clinic', FALSE, 0.00, 2),
('Johns Cafe & Bar', TRUE, 50.00, 1),
('Mikes Walk-in Barber', FALSE, 0.00, 3); -- ร้านนี้ไม่มี time slot เลย -> ระบบจะจับเป็น walk-in ให้อัตโนมัติ
-- STEP 4: Subscriptions
-- 7. Subscriptions
INSERT INTO Subscription (start_date, end_date, business_id, plan_id, substatus_id) VALUES 
('2026-07-01', '2026-07-31', 1, 2, 1), -- Johns Barber -> Basic Plan (Active)
('2026-07-01', '2026-12-31', 2, 3, 1), -- Sarah Dental -> Pro Plan (Active)
('2026-07-15', '2026-07-29', 3, 1, 1), -- Johns Cafe -> Free Trial (Active)
('2026-07-01', '2026-12-31', 4, 2, 1); -- Mikes Walk-in Barber -> Basic Plan (Active)
-- 8. Time Slots
-- หมายเหตุ: business_id = 4 (Mikes Walk-in Barber) ไม่มี time slot เลยโดยตั้งใจ
-- เพื่อให้ getBusinesses ตีความเป็น queue_type = 'walkin' และ frontend เปิดให้กดจองได้ทันทีโดยไม่ต้องเลือกเวลา
INSERT INTO Time_Slot (date, start_time, end_time, business_id) VALUES 
-- Johns Barber Shop (business_id = 1)
('2026-07-29', '10:00:00', '11:00:00', 1),
('2026-07-29', '11:00:00', '12:00:00', 1),
('2026-07-29', '13:00:00', '14:00:00', 1),
-- Sarah Dental Clinic (business_id = 2)
('2026-07-29', '09:00:00', '10:00:00', 2),
('2026-07-29', '14:00:00', '15:00:00', 2),
-- Johns Cafe & Bar (business_id = 3)
('2026-07-29', '12:00:00', '13:00:00', 3),
('2026-07-29', '18:00:00', '19:00:00', 3);