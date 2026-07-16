-- =========================================================
-- STEP 1: Master Tables
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

-- 5. Owners
INSERT INTO Owner (fname, lname, phone_number, email) VALUES 
('John', 'Smith', '081-234-5678', 'john.smith@gmail.com'),
('Sarah', 'Connor', '089-876-5432', 'sarah.c@clinic.com');

-- 6. Customers
INSERT INTO Customer (fname, lname, phone_number, email) VALUES 
('Alex', 'Mercer', '086-111-2222', 'alex.m@hotmail.com'),
('Emma', 'Watson', '087-333-4444', 'emma.w@gmail.com'),
('Bruce', 'Wayne', '088-555-6666', 'bruce@waynecorp.com');


-- =========================================================
-- STEP 2: Relationship Tables
-- =========================================================

-- 7. Businesses (owner_id: 1=John, 2=Sarah)
INSERT INTO Business (business_name, is_deposit, deposit_amount, owner_id) VALUES 
('Johns Barber Shop (Siam Branch)', TRUE, 100.00, 1),
('Sarah Dental Clinic', FALSE, 0.00, 2);

-- 8. Subscriptions
INSERT INTO Subscription (start_date, end_date, business_id, plan_id, substatus_id) VALUES 
('2026-07-01', '2026-07-31', 1, 2, 1), -- Barber Shop subscribes to Basic (Active)
('2026-07-01', '2026-12-31', 2, 3, 1); -- Dental Clinic subscribes to Pro (Active)

-- 9. Subscription Payments
INSERT INTO Subscription_Payment (amount, subscription_id) VALUES 
(990.00, 1),
(2590.00, 2);

-- 10. Queues (queue_id: 1=Barber 15 Jul, 2=Dental 15 Jul)
INSERT INTO Queue (date, business_id) VALUES 
('2026-07-15', 1), 
('2026-07-15', 2); 

-- 11. Time Slots
INSERT INTO Time_Slot (date, start_time, end_time, business_id) VALUES 
('2026-07-15', '10:00:00', '11:00:00', 1), -- timeslot_id = 1 (Barber 10-11 AM)
('2026-07-15', '11:00:00', '12:00:00', 1), -- timeslot_id = 2 (Barber 11-12 AM)
('2026-07-15', '13:00:00', '14:00:00', 2); -- timeslot_id = 3 (Dental 1-2 PM)


-- =========================================================
-- STEP 3: Transaction Tables
-- =========================================================

-- 12. Tickets (customer_id: 1=Alex, 2=Emma, 3=Bruce)
-- status_id: 1=Waiting, 2=Serving, 3=Completed
INSERT INTO Ticket (queue_id, timeslot_id, customer_id, status_id) VALUES 
(1, 1, 1, 3), -- Alex booked Barber at 10 AM (Completed)
(1, 2, 2, 1), -- Emma booked Barber at 11 AM (Waiting)
(2, 3, 3, 1); -- Bruce booked Dental at 1 PM (Waiting)

-- 13. Payments (ticket_id: 1=Alex, 2=Emma, 3=Bruce)
-- status_id: 1=Unpaid, 2=Paid
INSERT INTO Payment (amount, status_id, ticket_id) VALUES 
(100.00, 2, 1), -- Alex paid deposit $100
(100.00, 2, 2), -- Emma paid deposit $100
(0.00, 1, 3);   -- Bruce booking with no deposit (Unpaid)