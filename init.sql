-- No Foreign Key

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
    email         VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE Ticket_Status (
    status_id SERIAL PRIMARY KEY,
    status_name VARCHAR(20) UNIQUE NOT NULL
);

CREATE TABLE Payment_Status (
    status_id    SERIAL PRIMARY KEY,
    status_name  VARCHAR(20) UNIQUE NOT NULL
);


CREATE TABLE Subscription_Plan (
    plan_id SERIAL PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL
);

CREATE TABLE Subscription_Status (
    substatus_id    SERIAL PRIMARY KEY,
    substatus_name  VARCHAR(20) UNIQUE NOT NULL
);

-- Relation

CREATE TABLE Business (
    business_id SERIAL PRIMARY KEY,
    business_name VARCHAR(200) NOT NULL,
    is_deposit BOOLEAN DEFAULT FALSE,
    deposit_amount NUMERIC(10, 2) DEFAULT 0.00,
    owner_id INT REFERENCES Owner(owner_id) ON DELETE CASCADE
);

CREATE TABLE Subscription (
    subscription_id SERIAL PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    business_id INT REFERENCES Business(business_id) ON DELETE CASCADE,
    plan_id INT REFERENCES Subscription_Plan(plan_id),
    substatus_id INT REFERENCES Subscription_Status(substatus_id)
);

CREATE TABLE Subscription_Payment (
    sub_payment_id SERIAL PRIMARY KEY,
    amount NUMERIC(10, 2) NOT NULL,
    subscription_id INT REFERENCES Subscription(subscription_id) ON DELETE CASCADE
);

CREATE TABLE Queue (
    queue_id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    business_id INT REFERENCES Business(business_id) ON DELETE CASCADE
);

CREATE TABLE Time_Slot (
    timeslot_id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    business_id INT REFERENCES Business(business_id) ON DELETE CASCADE
);


-- Main Table

CREATE TABLE Ticket (
    ticket_id SERIAL PRIMARY KEY,
    queue_id INT REFERENCES Queue(queue_id) ON DELETE CASCADE,
    timeslot_id INT REFERENCES Time_Slot(timeslot_id),
    customer_id INT REFERENCES Customer(customer_id) ON DELETE CASCADE,
    status_id INT REFERENCES Ticket_Status(status_id)
);

CREATE TABLE Payment (
    payment_id SERIAL PRIMARY KEY,
    amount NUMERIC(10, 2) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status_id INT REFERENCES Payment_Status(status_id),
    ticket_id INT REFERENCES Ticket(ticket_id) ON DELETE CASCADE
);