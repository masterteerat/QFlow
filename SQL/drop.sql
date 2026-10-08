-- Manual reset script (NOT for docker-entrypoint-initdb.d).
-- Drops EVERY table, including the RBAC / blacklist / OTP tables the old drop.sql forgot.
-- Usage:  psql "$DATABASE_URL" -f scripts/reset.sql
--         psql "$DATABASE_URL" -f db/01_init.sql
--         psql "$DATABASE_URL" -f db/02_data.sql
DROP TABLE IF EXISTS
    notification,
    blacklist,
    tier,
    login_otp,
    payment,
    ticket,
    time_slot,
    queue,
    subscription_payment,
    subscription,
    business,
    category,
    subscription_status,
    subscription_plan,
    payment_status,
    ticket_status,
    owner,
    customer,
    user_group,
    role_permission,
    permission,
    object,
    role
CASCADE;