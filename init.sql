-- ============================================================
-- QFlow Database Schema (PostgreSQL) — FINAL COMBINED VERSION
-- Fixes applied vs the opencode version:
--   1. timeslot_id / queue_id FK: ON DELETE SET NULL -> ON DELETE RESTRICT
--      (SET NULL would violate the XOR check constraint)
--   2. status_id FKs on lookup tables: ON DELETE CASCADE -> ON DELETE RESTRICT
--      (CASCADE would silently delete all rows using that status)
--   3. Added missing Subscription_plan seed data before Subscription insert
--   4. Fixed example queries to correctly join Ticket_Status for status_name
-- ============================================================

-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS Subscription_payment CASCADE;
DROP TABLE IF EXISTS Subscription CASCADE;
DROP TABLE IF EXISTS Subscription_status CASCADE;
DROP TABLE IF EXISTS Subscription_plan CASCADE;
DROP TABLE IF EXISTS Payment CASCADE;
DROP TABLE IF EXISTS Payment_Status CASCADE;
DROP TABLE IF EXISTS Ticket CASCADE;
DROP TABLE IF EXISTS Ticket_Status CASCADE;
DROP TABLE IF EXISTS Queue CASCADE;
DROP TABLE IF EXISTS Time_slot CASCADE;
DROP TABLE IF EXISTS Queue_type CASCADE;
DROP TABLE IF EXISTS Owner_Business CASCADE;
DROP TABLE IF EXISTS Business CASCADE;
DROP TABLE IF EXISTS Owner CASCADE;
DROP TABLE IF EXISTS Customer CASCADE;

-- ============================================
-- Core Entities
-- ============================================

CREATE TABLE Customer (
    customer_id   SERIAL PRIMARY KEY,
    fname         VARCHAR(100) NOT NULL,
    lname         VARCHAR(100) NOT NULL,
    phone_number  VARCHAR(20),
    email         VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE Owner (
    owner_id      SERIAL PRIMARY KEY,
    fname         VARCHAR(100) NOT NULL,
    lname         VARCHAR(100) NOT NULL,
    phone_number  VARCHAR(20),
    email         VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE Business (
    business_id     SERIAL PRIMARY KEY,
    business_name   VARCHAR(255) NOT NULL,
    deposit_amount  DECIMAL(10, 2) DEFAULT 0.00,
    is_deposit      BOOLEAN DEFAULT TRUE
);

-- ============================================
-- Junction Table (Many-to-Many: Owner <-> Business)
-- ============================================

CREATE TABLE Owner_Business (
    owner_id     INTEGER NOT NULL,
    business_id  INTEGER NOT NULL,
    PRIMARY KEY (owner_id, business_id),
    FOREIGN KEY (owner_id) REFERENCES Owner(owner_id) ON DELETE CASCADE,
    FOREIGN KEY (business_id) REFERENCES Business(business_id) ON DELETE CASCADE
);

-- ============================================
-- Business Related Tables
-- ============================================

CREATE TABLE Queue_type (
    type_id      SERIAL PRIMARY KEY,
    type_name    VARCHAR(100) NOT NULL,
    business_id  INTEGER NOT NULL,
    FOREIGN KEY (business_id) REFERENCES Business(business_id) ON DELETE CASCADE,
    UNIQUE (business_id, type_name)
);

CREATE TABLE Time_slot (
    timeslot_id  SERIAL PRIMARY KEY,
    business_id  INTEGER NOT NULL,
    date         DATE NOT NULL,
    start_time   TIME NOT NULL,
    end_time     TIME NOT NULL,
    FOREIGN KEY (business_id) REFERENCES Business(business_id) ON DELETE CASCADE,
    UNIQUE (business_id, date, start_time, end_time)
);

-- Queue (Running Queue - "now serving" counter, one per business)
CREATE TABLE Queue (
    queue_id       SERIAL PRIMARY KEY,
    business_id    INTEGER NOT NULL,
    current_queue  INT DEFAULT 0,
    FOREIGN KEY (business_id) REFERENCES Business(business_id) ON DELETE CASCADE,
    UNIQUE (business_id)
);

-- ============================================
-- Status Tables (Shared Lookup Tables)
-- ============================================

CREATE TABLE Ticket_Status (
    status_id    SERIAL PRIMARY KEY,
    status_name  VARCHAR(50) NOT NULL,
    UNIQUE (status_name)
);

-- Payment_Status (shared by Payment and Subscription_payment)
CREATE TABLE Payment_Status (
    status_id    SERIAL PRIMARY KEY,
    status_name  VARCHAR(50) NOT NULL,
    UNIQUE (status_name)
);

-- ============================================
-- Ticket & Payment
-- ============================================

CREATE TABLE Ticket (
    ticket_id     SERIAL PRIMARY KEY,
    customer_id   INTEGER NOT NULL,
    business_id   INTEGER NOT NULL,
    ticket_type   VARCHAR(20) NOT NULL CHECK (ticket_type IN ('scheduled', 'running')),
    timeslot_id   INTEGER,
    queue_id      INTEGER,
    queue_number  INT,
    pax           INT DEFAULT 1,
    date          DATE NOT NULL,
    status_id     INTEGER NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES Customer(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (business_id) REFERENCES Business(business_id) ON DELETE CASCADE,
    -- FIX #1: RESTRICT instead of SET NULL — SET NULL would break the XOR check below
    FOREIGN KEY (timeslot_id) REFERENCES Time_slot(timeslot_id) ON DELETE RESTRICT,
    FOREIGN KEY (queue_id) REFERENCES Queue(queue_id) ON DELETE RESTRICT,
    -- FIX #2: RESTRICT instead of CASCADE — never silently mass-delete tickets
    -- just because a status lookup row was removed
    FOREIGN KEY (status_id) REFERENCES Ticket_Status(status_id) ON DELETE RESTRICT,
    -- XOR Constraint: exactly one of timeslot_id or queue_id must be non-null
    CONSTRAINT xor_timeslot_queue CHECK (
        (ticket_type = 'scheduled' AND timeslot_id IS NOT NULL AND queue_id IS NULL) OR
        (ticket_type = 'running' AND timeslot_id IS NULL AND queue_id IS NOT NULL)
    )
);

CREATE TABLE Payment (
    payment_id  SERIAL PRIMARY KEY,
    ticket_id   INTEGER UNIQUE NOT NULL,
    amount      DECIMAL(10, 2) NOT NULL,
    paid_at     TIMESTAMP,
    status_id   INTEGER NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES Ticket(ticket_id) ON DELETE CASCADE,
    -- FIX #2: RESTRICT instead of CASCADE
    FOREIGN KEY (status_id) REFERENCES Payment_Status(status_id) ON DELETE RESTRICT
);

-- ============================================
-- Subscription & Subscription Payment
-- ============================================

CREATE TABLE Subscription_plan (
    plan_id      SERIAL PRIMARY KEY,
    plan_name    VARCHAR(100) NOT NULL,
    description  TEXT,
    price        DECIMAL(10, 2) NOT NULL
);

CREATE TABLE Subscription_status (
    substatus_id    SERIAL PRIMARY KEY,
    substatus_name  VARCHAR(50) NOT NULL,
    UNIQUE (substatus_name)
);

CREATE TABLE Subscription (
    subscription_id  SERIAL PRIMARY KEY,
    business_id      INTEGER UNIQUE NOT NULL,
    plan_id          INTEGER NOT NULL,
    substatus_id     INTEGER NOT NULL,
    start_date       DATE NOT NULL,
    end_date         DATE NOT NULL,
    FOREIGN KEY (business_id) REFERENCES Business(business_id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES Subscription_plan(plan_id) ON DELETE RESTRICT,
    -- FIX #2: RESTRICT instead of CASCADE
    FOREIGN KEY (substatus_id) REFERENCES Subscription_status(substatus_id) ON DELETE RESTRICT
);

CREATE TABLE Subscription_payment (
    sub_payment_id   SERIAL PRIMARY KEY,
    subscription_id  INTEGER NOT NULL,
    amount           DECIMAL(10, 2) NOT NULL,
    paid_at          TIMESTAMP,
    status_id        INTEGER NOT NULL,
    FOREIGN KEY (subscription_id) REFERENCES Subscription(subscription_id) ON DELETE CASCADE,
    -- FIX #2: RESTRICT instead of CASCADE
    FOREIGN KEY (status_id) REFERENCES Payment_Status(status_id) ON DELETE RESTRICT
);

-- ============================================================
-- Seed Data
-- ============================================================

INSERT INTO Ticket_Status (status_name) VALUES
('pending'), ('confirmed'), ('completed'), ('cancelled');

INSERT INTO Payment_Status (status_name) VALUES
('pending'), ('paid'), ('failed');

INSERT INTO Subscription_status (substatus_name) VALUES
('active'), ('inactive'), ('expired');

-- FIX #3: this was missing in the previous version — Subscription references
-- plan_id and would fail on insert without it
INSERT INTO Subscription_plan (plan_name, description, price) VALUES
('Basic', 'Up to 1 business location, core booking features', 299.00),
('Pro', 'Multiple locations, priority support, analytics', 799.00);

INSERT INTO Business (business_name, deposit_amount, is_deposit) VALUES
('Sample Business 1', 100.00, TRUE),
('Sample Business 2', 200.00, TRUE);

INSERT INTO Queue (business_id, current_queue) VALUES
(1, 0),
(2, 0);

INSERT INTO Queue_type (type_name, business_id) VALUES
('General Queue', 1),
('Priority Queue', 1),
('General Queue', 2),
('Priority Queue', 2);

INSERT INTO Time_slot (business_id, date, start_time, end_time) VALUES
(1, '2026-07-15', '09:00:00', '10:00:00'),
(1, '2026-07-15', '10:00:00', '11:00:00'),
(2, '2026-07-15', '10:00:00', '11:00:00');

INSERT INTO Subscription (business_id, plan_id, substatus_id, start_date, end_date) VALUES
(1, 1, 1, '2026-07-01', '2026-12-31'),
(2, 1, 1, '2026-07-01', '2026-12-31');

-- ============================================================
-- Example Queries
-- ============================================================

-- Businesses with their queue types
SELECT
    b.business_id,
    b.business_name,
    b.deposit_amount,
    b.is_deposit,
    qt.type_name AS queue_type
FROM Business b
LEFT JOIN Queue_type qt ON b.business_id = qt.business_id
ORDER BY b.business_name;

-- Scheduled tickets for a specific business
-- FIX #4: join Ticket_Status to get status_name (Time_slot has no status column)
SELECT
    t.ticket_id,
    c.fname || ' ' || c.lname AS customer_name,
    t.ticket_type,
    tslot.date,
    tslot.start_time,
    tslot.end_time,
    t.queue_number,
    t.pax,
    tstat.status_name AS ticket_status
FROM Ticket t
JOIN Customer c ON t.customer_id = c.customer_id
JOIN Time_slot tslot ON t.timeslot_id = tslot.timeslot_id
JOIN Ticket_Status tstat ON t.status_id = tstat.status_id
WHERE t.business_id = 1
  AND t.ticket_type = 'scheduled';

-- Running tickets (walk-in queue) for a specific business
-- FIX #4: join Ticket_Status to get status_name (Ticket only stores status_id)
SELECT
    t.ticket_id,
    c.fname || ' ' || c.lname AS customer_name,
    t.ticket_type,
    t.queue_number,
    t.pax,
    tstat.status_name AS ticket_status,
    q.current_queue
FROM Ticket t
JOIN Customer c ON t.customer_id = c.customer_id
JOIN Ticket_Status tstat ON t.status_id = tstat.status_id
JOIN Queue q ON t.business_id = q.business_id
WHERE t.business_id = 1
  AND t.ticket_type = 'running';

-- Subscription details for a business
SELECT
    s.subscription_id,
    b.business_name,
    sp.plan_name,
    sp.price,
    ss.substatus_name,
    s.start_date,
    s.end_date
FROM Subscription s
JOIN Business b ON s.business_id = b.business_id
JOIN Subscription_plan sp ON s.plan_id = sp.plan_id
JOIN Subscription_status ss ON s.substatus_id = ss.substatus_id
WHERE b.business_id = 1;

-- Next available time slot for a business
SELECT * FROM Time_slot
WHERE business_id = 1
  AND date = '2026-07-15'
ORDER BY start_time
LIMIT 1;

-- Current queue position and next available slot
SELECT
    q.current_queue AS current_queue,
    tslot.start_time AS next_slot_time
FROM Queue q
JOIN Time_slot tslot ON q.business_id = tslot.business_id
WHERE q.business_id = 1
ORDER BY tslot.start_time
LIMIT 1;