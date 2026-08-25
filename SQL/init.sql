CREATE TABLE customer (
    customer_id  SERIAL PRIMARY KEY,
    fname        VARCHAR(100) NOT NULL,
    lname        VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    email        VARCHAR(255) UNIQUE NOT NULL,
    password     VARCHAR(255) NOT NULL
);

CREATE TABLE owner (
    owner_id     SERIAL PRIMARY KEY,
    fname        VARCHAR(100) NOT NULL,
    lname        VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    email        VARCHAR(100) UNIQUE NOT NULL,
    password     VARCHAR(255) NOT NULL
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
    category_id  SERIAL PRIMARY KEY,
    name         VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE business (
    business_id    SERIAL PRIMARY KEY,
    business_name  VARCHAR(200) NOT NULL,
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
    max_capacity INT NOT NULL DEFAULT 1,
    business_id INT REFERENCES business(business_id) ON DELETE CASCADE
);

CREATE TABLE ticket (
    ticket_id    SERIAL PRIMARY KEY,
    queue_number VARCHAR(20) NOT NULL,
    queue_id     INT REFERENCES queue(queue_id) ON DELETE CASCADE,
    timeslot_id  INT REFERENCES time_slot(timeslot_id),
    customer_id  INT REFERENCES customer(customer_id) ON DELETE CASCADE,
    status_id    INT DEFAULT 1 REFERENCES ticket_status(status_id),
    pax          INT NOT NULL DEFAULT 1,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment (
    payment_id SERIAL PRIMARY KEY,
    amount     NUMERIC(10, 2) NOT NULL,
    timestamp  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status_id  INT REFERENCES payment_status(status_id),
    ticket_id  INT REFERENCES ticket(ticket_id) ON DELETE CASCADE
);
