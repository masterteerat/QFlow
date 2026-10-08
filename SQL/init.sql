CREATE TABLE object (
    obj_ID      SERIAL PRIMARY KEY,
    obj_name    VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE role (
    role_ID SERIAL PRIMARY KEY,
    role_name VARCHAR(255) UNIQUE NOT NULL,
    description VARCHAR(255) NOT NULL
);

CREATE TABLE permission (
    permission_ID SERIAL PRIMARY KEY,
    permission_name VARCHAR(255) NOT NULL,
    obj_ID INT NOT NULL REFERENCES object(obj_ID) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    CONSTRAINT uq_permission_obj_action UNIQUE (obj_ID, action)
);

CREATE TABLE role_permission (
    role_ID INT NOT NULL,
    permission_ID INT NOT NULL,
    PRIMARY KEY (role_ID, permission_ID),
    FOREIGN KEY (role_ID) REFERENCES role(role_ID) ON DELETE CASCADE,
    FOREIGN KEY (permission_ID) REFERENCES permission(permission_ID) ON DELETE CASCADE
);

CREATE TABLE user_group (
    group_ID    SERIAL PRIMARY KEY,
    group_name  VARCHAR(255) NOT NULL,
    role_ID     INT REFERENCES role(role_ID)
);

CREATE TABLE customer (
    customer_id  SERIAL PRIMARY KEY,
    fname        VARCHAR(100) NOT NULL,
    lname        VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    email        VARCHAR(255) UNIQUE NOT NULL,
    password     VARCHAR(255) NOT NULL,
    group_ID     INT REFERENCES user_group(group_ID),
    role_ID      INT REFERENCES role(role_ID),
    email_notifications_opt_in BOOLEAN DEFAULT FALSE,  -- Daily schedule email (08:00)
    daily_email_hour           INT NOT NULL DEFAULT 8 CHECK (daily_email_hour BETWEEN 0 AND 23),  -- hour of day (Bangkok) the daily email is sent
    daily_email_last_sent      DATE,  -- guards against sending twice on the same day
    queue_reminder_opt_in      BOOLEAN NOT NULL DEFAULT FALSE,  -- Reminder before the queue/slot starts
    -- how many hours before the slot starts the queue reminder is sent (customer's choice)
    reminder_hours_before INT NOT NULL DEFAULT 1 CHECK (reminder_hours_before BETWEEN 1 AND 24),
    tokens_valid_after TIMESTAMPTZ  -- logout revokes every token issued before this moment
);

CREATE TABLE owner (
    owner_id     SERIAL PRIMARY KEY,
    fname        VARCHAR(100) NOT NULL,
    lname        VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    email        VARCHAR(255) UNIQUE NOT NULL,
    password     VARCHAR(255) NOT NULL,
    group_ID     INT REFERENCES user_group(group_ID),
    role_ID      INT REFERENCES role(role_ID),
    tokens_valid_after TIMESTAMPTZ
);

CREATE TABLE ticket_status (
    status_id   SERIAL PRIMARY KEY,
    status_name VARCHAR(20) UNIQUE NOT NULL
);

CREATE TABLE payment_status (
    status_id   SERIAL PRIMARY KEY,
    status_name VARCHAR(20) UNIQUE NOT NULL
);

CREATE TABLE subscription_plan (
    plan_id     SERIAL PRIMARY KEY,
    plan_name   VARCHAR(100) NOT NULL,
    description TEXT,
    price       NUMERIC(10, 2) NOT NULL
);

CREATE TABLE subscription_status (
    substatus_id   SERIAL PRIMARY KEY,
    substatus_name VARCHAR(20) UNIQUE NOT NULL
);

CREATE TABLE category (
    category_id    SERIAL PRIMARY KEY,
    name           VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE business (
    business_id    SERIAL PRIMARY KEY,
    business_name  VARCHAR(200) NOT NULL,
    description    TEXT,
    image          VARCHAR(255) DEFAULT '/uploads/business/default-business.jpg',
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE = shop closed (soft delete, tickets/history are kept)
    queue_type     VARCHAR(10) NOT NULL DEFAULT 'walkin' CHECK (queue_type IN ('walkin','timeslot')),  -- source of truth (was inferred from time_slot rows)
    is_deposit     BOOLEAN DEFAULT FALSE,
    deposit_amount NUMERIC(10, 2) DEFAULT 0.00,
    owner_id       INT REFERENCES owner(owner_id) ON DELETE CASCADE,
    category_id    INT REFERENCES category(category_id)
);

CREATE TABLE subscription (
    subscription_id SERIAL PRIMARY KEY,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    business_id     INT REFERENCES business(business_id) ON DELETE CASCADE,
    plan_id         INT REFERENCES subscription_plan(plan_id),
    substatus_id    INT REFERENCES subscription_status(substatus_id)
);

CREATE TABLE subscription_payment (
    sub_payment_id  SERIAL PRIMARY KEY,
    amount          NUMERIC(10, 2) NOT NULL,
    subscription_id INT REFERENCES subscription(subscription_id) ON DELETE CASCADE
);

CREATE TABLE queue (
    queue_id    SERIAL PRIMARY KEY,
    date        DATE NOT NULL,
    business_id INT REFERENCES business(business_id) ON DELETE CASCADE,
    CONSTRAINT uq_queue_date_business UNIQUE (date, business_id)
);

CREATE TABLE time_slot (
    timeslot_id SERIAL PRIMARY KEY,
    date        DATE NOT NULL,
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    max_capacity INT NOT NULL DEFAULT 1 CHECK (max_capacity > 0),
    business_id INT REFERENCES business(business_id) ON DELETE CASCADE,
    -- FIX: กัน slot ซ้ำ (updateSchedule เคยสร้างซ้ำกับ slot ที่มีคนจองแล้ว)
    CHECK (end_time > start_time),
    CONSTRAINT uq_time_slot UNIQUE (business_id, date, start_time, end_time)
);

CREATE TABLE ticket (
    ticket_id    SERIAL PRIMARY KEY,
    queue_number VARCHAR(20) NOT NULL,
    queue_id     INT NOT NULL REFERENCES queue(queue_id) ON DELETE CASCADE,
    timeslot_id  INT REFERENCES time_slot(timeslot_id),
    customer_id  INT REFERENCES customer(customer_id) ON DELETE CASCADE,
    status_id    INT DEFAULT 1 REFERENCES ticket_status(status_id),
    pax          INT NOT NULL DEFAULT 1 CHECK (pax > 0),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reminder_sent BOOLEAN NOT NULL DEFAULT FALSE, -- FIX: กันส่งอีเมลเตือนซ้ำ
    cancelled_at  TIMESTAMPTZ,        -- when it was cancelled (owner's cancel history)
    cancelled_by  VARCHAR(20),        -- 'customer' | 'no_show'
    CONSTRAINT uq_ticket_queue_number UNIQUE (queue_id, queue_number)
);

CREATE TABLE payment (
    payment_id SERIAL PRIMARY KEY,
    amount     NUMERIC(10, 2) NOT NULL,
    timestamp  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status_id  INT REFERENCES payment_status(status_id),
    ticket_id  INT NOT NULL UNIQUE REFERENCES ticket(ticket_id) ON DELETE CASCADE
);

CREATE TABLE notification (
    notification_id SERIAL PRIMARY KEY,
    message         TEXT NOT NULL,
    ticket_id       INT REFERENCES ticket(ticket_id) ON DELETE CASCADE,
    customer_id     INT REFERENCES customer(customer_id) ON DELETE CASCADE
);

CREATE TABLE tier (
    tier_id SERIAL PRIMARY KEY,
    name    VARCHAR(100) NOT NULL,
    time    INT NOT NULL
);

CREATE TABLE blacklist (
    list_id      SERIAL PRIMARY KEY,
    elapsed_time INT NOT NULL DEFAULT 0, -- legacy counter, no longer used to decide if a ban is active
    customer_id  INT NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE,
    tier_id      INT NOT NULL REFERENCES tier(tier_id),
    -- when the current ban started; remaining time = tier.time - (now - banned_at)
    banned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE login_otp (
    otp_id      SERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    role        VARCHAR(20) NOT NULL,
    otp_code    VARCHAR(6) NOT NULL,
    attempts    INT NOT NULL DEFAULT 0, -- FIX: จำกัดจำนวนครั้งที่เดา OTP
    expires_at  TIMESTAMP NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_login_otp_email_role ON login_otp(email, role);
CREATE INDEX idx_login_otp_expires ON login_otp(expires_at);
-- FIX: 1 คน = 1 แถวใน blacklist (โค้ด no-show ทั้งระบบสมมติแบบนี้)
CREATE UNIQUE INDEX idx_blacklist_customer ON blacklist(customer_id);
CREATE INDEX idx_notification_customer ON notification(customer_id);
CREATE INDEX idx_ticket_customer ON ticket(customer_id);
CREATE INDEX idx_ticket_queue ON ticket(queue_id);
CREATE INDEX idx_ticket_timeslot ON ticket(timeslot_id);
CREATE INDEX idx_time_slot_business_date ON time_slot(business_id, date);
CREATE UNIQUE INDEX idx_customer_email_lower ON customer(lower(email));
CREATE UNIQUE INDEX idx_owner_email_lower ON owner(lower(email));


-- =====================================================================
-- REFERENCE DATA  (required in EVERY environment, including production)
-- The app cannot work without these rows: ticket statuses, roles and
-- permissions (RBAC), categories, plans, ban tiers.
-- IDs matter: ticket_status 1-4 and payment_status 2 are used by the code.
-- Sample/test accounts and shops live in data.sql, NOT here.
-- =====================================================================

INSERT INTO ticket_status (status_name) VALUES
('Waiting'),     -- 1
('Serving'),     -- 2
('Completed'),   -- 3
('Cancelled');   -- 4

INSERT INTO payment_status (status_name) VALUES
('Unpaid'),      -- 1
('Paid'),        -- 2
('Refunded');    -- 3

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
('Tech Repair'),
('Food & Beverage'),
('Pet Care'),
('Fashion & Clothing'),
('Auto Service');

-- Ban levels with durations (in minutes; 0 = permanent)
INSERT INTO tier (name, time) VALUES
  ('Warning', 30),         -- 30 minutes
  ('Temporary Ban', 1440), -- 24 hours
  ('Permanent Ban', 0);

-- ---------- RBAC: roles ----------
INSERT INTO role (role_name, description) VALUES
  ('customer', 'the user who reserve the queue'),
  ('owner',    'the user who want to register the shop')
ON CONFLICT (role_name) DO NOTHING;

-- ---------- RBAC: objects ----------
INSERT INTO object (obj_name) VALUES
  ('ticket'), ('business'), ('schedule'), ('queue'), ('analytics')
ON CONFLICT (obj_name) DO NOTHING;

-- ---------- RBAC: permissions (object + action) ----------
INSERT INTO permission (permission_name, obj_ID, action)
SELECT v.obj || ':' || v.action, o.obj_ID, v.action
FROM (VALUES
  ('ticket',    'create'),
  ('ticket',    'read'),
  ('ticket',    'cancel'),
  ('ticket',    'checkin'),
  ('ticket',    'complete'),
  ('ticket',    'no-show'),
  ('business',  'read'),
  ('business',  'create'),
  ('business',  'update'),
  ('business',  'delete'),
  ('schedule',  'read'),
  ('schedule',  'update'),
  ('queue',     'read'),
  ('analytics', 'read')
) AS v(obj, action)
JOIN object o ON o.obj_name = v.obj
ON CONFLICT (obj_ID, action) DO NOTHING;

-- ---------- RBAC: role -> permission ----------
INSERT INTO role_permission (role_ID, permission_ID)
SELECT r.role_ID, p.permission_ID
FROM (VALUES
  ('customer', 'ticket:create'),
  ('customer', 'ticket:read'),
  ('customer', 'ticket:cancel'),
  ('owner', 'ticket:checkin'),
  ('owner', 'ticket:complete'),
  ('owner', 'ticket:no-show'),
  ('owner', 'business:read'),
  ('owner', 'business:create'),
  ('owner', 'business:update'),
  ('owner', 'business:delete'),
  ('owner', 'schedule:read'),
  ('owner', 'schedule:update'),
  ('owner', 'queue:read'),
  ('owner', 'analytics:read')
) AS v(role_name, perm_name)
JOIN role r ON r.role_name = v.role_name
JOIN permission p ON p.permission_name = v.perm_name
ON CONFLICT DO NOTHING;
