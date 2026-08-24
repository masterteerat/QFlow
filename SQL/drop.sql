TRUNCATE TABLE 
    Payment, 
    Ticket, 
    Time_Slot, 
    Queue, 
    Subscription_Payment, 
    Subscription, 
    Business, 
    Category,
    Subscription_Status, 
    Subscription_Plan, 
    Payment_Status, 
    Ticket_Status, 
    Owner, 
    Customer 
RESTART IDENTITY CASCADE;

DROP TABLE IF EXISTS 
    Payment, 
    Ticket, 
    Time_Slot, 
    Queue, 
    Subscription_Payment, 
    Subscription, 
    Business, 
    Category,
    Subscription_Status, 
    Subscription_Plan, 
    Payment_Status, 
    Ticket_Status, 
    Owner, 
    Customer 
CASCADE;