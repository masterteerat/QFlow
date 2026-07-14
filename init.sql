-- ============================================================
-- QFlow Database Schema (PostgreSQL version)
-- Renamed entities: User -> Customer, Business_Owner -> Owner,
--                    Timeslot -> Time_slot, Running_Queue -> Queue
-- ============================================================

CREATE TYPE ticket_type_enum AS ENUM ('scheduled', 'running');

-- ------------------------------------------------------------
-- 1. CUSTOMER
-- ------------------------------------------------------------
CREATE TABLE Customer (
    customer_id   SERIAL PRIMARY KEY,
    fname         VARCHAR(100) NOT NULL,
    lname         VARCHAR(100) NOT NULL,
    phone_number  VARCHAR(20),
    email         VARCHAR(255) NOT NULL UNIQUE
);

-- ------------------------------------------------------------
-- 2. OWNER  (ธุรกิจนี้ใช้เจ้าของแยกจาก Customer ไม่ใช่ subtype
--    ของ Customer แล้ว ตามที่ภาพแยกสองเอนทิตีออกจากกันชัดเจน)
-- ------------------------------------------------------------
CREATE TABLE Owner (
    owner_id      SERIAL PRIMARY KEY,
    fname         VARCHAR(100) NOT NULL,
    lname         VARCHAR(100) NOT NULL,
    phone_number  VARCHAR(20),
    email         VARCHAR(255) NOT NULL UNIQUE
);

-- ------------------------------------------------------------
-- 3. BUSINESS
-- ------------------------------------------------------------
CREATE TABLE Business (
    business_id    SERIAL PRIMARY KEY,
    business_name  VARCHAR(255) NOT NULL,
    deposit_amount DECIMAL(10,2) DEFAULT 0,
    is_deposit     BOOLEAN NOT NULL DEFAULT FALSE
);

-- ------------------------------------------------------------
-- 4. OWNER_BUSINESS  (junction table for the n:m "Own" relationship)
-- ------------------------------------------------------------
CREATE TABLE Owner_Business (
    owner_id     INT NOT NULL,
    business_id  INT NOT NULL,
    PRIMARY KEY (owner_id, business_id),
    FOREIGN KEY (owner_id) REFERENCES Owner(owner_id) ON DELETE CASCADE,
    FOREIGN KEY (business_id) REFERENCES Business(business_id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 5. QUEUE_TYPE  (lookup, belongs to one Business)
-- ------------------------------------------------------------
CREATE TABLE Queue_type (
    type_id      SERIAL PRIMARY KEY,
    type_name    VARCHAR(100) NOT NULL,
    business_id  INT NOT NULL,
    FOREIGN KEY (business_id) REFERENCES Business(business_id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 6. TIME_SLOT  (belongs to one Business)
-- ------------------------------------------------------------
CREATE TABLE Time_slot (
    timeslot_id  SERIAL PRIMARY KEY,
    business_id  INT NOT NULL,
    date         DATE NOT NULL,
    start_time   TIME NOT NULL,
    end_time     TIME NOT NULL,
    FOREIGN KEY (business_id) REFERENCES Business(business_id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 7. QUEUE  (running queue "หน้าจอเรียกคิว", belongs to one Business)
-- ------------------------------------------------------------
CREATE TABLE Queue (
    queue_id       SERIAL PRIMARY KEY,
    business_id    INT NOT NULL,
    current_queue  INT NOT NULL DEFAULT 0,
    FOREIGN KEY (business_id) REFERENCES Business(business_id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 8. TICKET_STATUS  (lookup)
-- ------------------------------------------------------------
CREATE TABLE Ticket_Status (
    status_id    SERIAL PRIMARY KEY,
    status_name  VARCHAR(50) NOT NULL
);

-- ------------------------------------------------------------
-- 9. TICKET
--    ticket_type คุมโหมด, CHECK constraint บังคับ XOR
--    ระหว่าง timeslot_id กับ queue_id
-- ------------------------------------------------------------
CREATE TABLE Ticket (
    ticket_id     SERIAL PRIMARY KEY,
    customer_id   INT NOT NULL,
    business_id   INT NOT NULL,
    ticket_type   ticket_type_enum NOT NULL,
    timeslot_id   INT NULL,
    queue_id      INT NULL,
    queue_number  VARCHAR(20),
    pax           INT NOT NULL DEFAULT 1,
    date          DATE NOT NULL,
    status_id     INT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES Customer(customer_id),
    FOREIGN KEY (business_id) REFERENCES Business(business_id),
    FOREIGN KEY (timeslot_id) REFERENCES Time_slot(timeslot_id),
    FOREIGN KEY (queue_id) REFERENCES Queue(queue_id),
    FOREIGN KEY (status_id) REFERENCES Ticket_Status(status_id),
    CONSTRAINT chk_ticket_type_xor CHECK (
        (ticket_type = 'scheduled' AND timeslot_id IS NOT NULL AND queue_id IS NULL)
        OR
        (ticket_type = 'running' AND queue_id IS NOT NULL AND timeslot_id IS NULL)
    )
);

-- ------------------------------------------------------------
-- 10. PAYMENT_STATUS  (lookup, shared by Payment and Subscription_payment)
-- ------------------------------------------------------------
CREATE TABLE Payment_Status (
    status_id    SERIAL PRIMARY KEY,
    status_name  VARCHAR(50) NOT NULL
);

-- ------------------------------------------------------------
-- 11. PAYMENT  (customer's booking deposit — 1 Ticket : 0..1 Payment)
-- ------------------------------------------------------------
CREATE TABLE Payment (
    payment_id  SERIAL PRIMARY KEY,
    ticket_id   INT NOT NULL UNIQUE,
    amount      DECIMAL(10,2) NOT NULL,
    paid_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status_id   INT NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES Ticket(ticket_id) ON DELETE CASCADE,
    FOREIGN KEY (status_id) REFERENCES Payment_Status(status_id)
);

-- ------------------------------------------------------------
-- 12. SUBSCRIPTION_PLAN
-- ------------------------------------------------------------
CREATE TABLE Subscription_plan (
    plan_id      SERIAL PRIMARY KEY,
    plan_name    VARCHAR(100) NOT NULL,
    description  TEXT,
    price        DECIMAL(10,2) NOT NULL
);

-- ------------------------------------------------------------
-- 13. SUBSCRIPTION_STATUS  (lookup)
-- ------------------------------------------------------------
CREATE TABLE Subscription_status (
    substatus_id    SERIAL PRIMARY KEY,
    substatus_name  VARCHAR(50) NOT NULL
);

-- ------------------------------------------------------------
-- 14. SUBSCRIPTION  (1 Business : 1 active Subscription)
-- ------------------------------------------------------------
CREATE TABLE Subscription (
    subscription_id  SERIAL PRIMARY KEY,
    business_id      INT NOT NULL UNIQUE,
    plan_id          INT NOT NULL,
    substatus_id     INT NOT NULL,
    start_date       DATE NOT NULL,
    end_date         DATE,
    FOREIGN KEY (business_id) REFERENCES Business(business_id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES Subscription_plan(plan_id),
    FOREIGN KEY (substatus_id) REFERENCES Subscription_status(substatus_id)
);

-- ------------------------------------------------------------
-- 15. SUBSCRIPTION_PAYMENT
-- ------------------------------------------------------------
CREATE TABLE Subscription_payment (
    sub_payment_id   SERIAL PRIMARY KEY,
    subscription_id  INT NOT NULL,
    amount           DECIMAL(10,2) NOT NULL,
    status_id        INT NOT NULL,
    paid_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscription_id) REFERENCES Subscription(subscription_id) ON DELETE CASCADE,
    FOREIGN KEY (status_id) REFERENCES Payment_Status(status_id)
);