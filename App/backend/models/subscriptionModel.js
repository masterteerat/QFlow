const pool = require('../config/db');

const BKK_TODAY = `(NOW() AT TIME ZONE 'Asia/Bangkok')::date`;

// The platform fee every shop pays QFlow each month. It is the price of this plan in subscription_plan.
const FEE_PLAN_NAME = 'Basic Plan';

// SQL that is true when shop `b` has paid and its paid month has not run out yet.
// Shops that fail this are hidden from customers and cannot take bookings.
const SHOP_IS_PAID = `EXISTS (
  SELECT 1 FROM subscription s
  JOIN subscription_status st ON st.substatus_id = s.substatus_id
  WHERE s.business_id = b.business_id AND st.substatus_name = 'Active' AND s.end_date >= ${BKK_TODAY})`;

// One JSON object describing a shop's latest subscription. 'Active' past its end date reads as 'Expired'.
const SUBSCRIPTION_JSON = `(
  SELECT json_build_object(
    'subscription_id', s.subscription_id,
    'status', CASE WHEN st.substatus_name = 'Active' AND s.end_date < ${BKK_TODAY} THEN 'Expired' ELSE st.substatus_name END,
    'start_date', s.start_date,
    'end_date', s.end_date,
    'days_left', GREATEST(0, s.end_date - ${BKK_TODAY}),
    'plan_name', p.plan_name,
    'price', p.price)
  FROM subscription s
  JOIN subscription_status st ON st.substatus_id = s.substatus_id
  JOIN subscription_plan p ON p.plan_id = s.plan_id
  WHERE s.business_id = b.business_id
  ORDER BY s.subscription_id DESC LIMIT 1)`;

const getFeePlan = async (client) => {
  const { rows } = await client.query(
    `SELECT plan_id, plan_name, price FROM subscription_plan
      ORDER BY (plan_name = $1) DESC, price ASC LIMIT 1`, [FEE_PLAN_NAME]);
  return rows[0];
};

const statusId = async (client, name) =>
  (await client.query('SELECT substatus_id FROM subscription_status WHERE substatus_name = $1', [name])).rows[0].substatus_id;

const SubscriptionModel = {
  SHOP_IS_PAID,
  SUBSCRIPTION_JSON,

  // New shop: a 'Pending' subscription row. Nothing is paid yet, so the shop stays hidden.
  createPending: async (client, businessId) => {
    const plan = await getFeePlan(client);
    await client.query(
      `INSERT INTO subscription (start_date, end_date, business_id, plan_id, substatus_id)
       VALUES (${BKK_TODAY}, ${BKK_TODAY}, $1, $2, $3)`,
      [businessId, plan.plan_id, await statusId(client, 'Pending')]);
  },

  getForBusiness: async (businessId) => {
    const { rows } = await pool.query(
      `SELECT ${SUBSCRIPTION_JSON} AS subscription FROM business b WHERE b.business_id = $1`, [businessId]);
    const payments = await pool.query(
      `SELECT sp.sub_payment_id, sp.amount, sp.paid_at, sp.reference, sp.period_start::text AS period_start, sp.period_end::text AS period_end
         FROM subscription_payment sp JOIN subscription s ON s.subscription_id = sp.subscription_id
        WHERE s.business_id = $1 ORDER BY sp.sub_payment_id DESC LIMIT 12`, [businessId]);
    return { subscription: rows[0]?.subscription || null, payments: payments.rows };
  },

  // Records one month's payment. Still running -> the new month is added after the current end date
  // (no paid days are lost); pending or expired -> a fresh month starting today.
  pay: async (businessId, reference) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const plan = await getFeePlan(client);
      let sub = (await client.query(
        `SELECT subscription_id, end_date, (end_date >= ${BKK_TODAY} AND substatus_id = $2) AS running
           FROM subscription WHERE business_id = $1 ORDER BY subscription_id DESC LIMIT 1 FOR UPDATE`,
        [businessId, await statusId(client, 'Active')])).rows[0];
      if (!sub) {
        sub = (await client.query(
          `INSERT INTO subscription (start_date, end_date, business_id, plan_id, substatus_id)
           VALUES (${BKK_TODAY}, ${BKK_TODAY}, $1, $2, $3)
           RETURNING subscription_id, end_date, FALSE AS running`,
          [businessId, plan.plan_id, await statusId(client, 'Pending')])).rows[0];
      }
      const upd = await client.query(
        `UPDATE subscription
            SET substatus_id = $2, plan_id = $3,
                start_date = CASE WHEN $4 THEN start_date ELSE ${BKK_TODAY} END,
                end_date = ((CASE WHEN $4 THEN end_date ELSE ${BKK_TODAY} END) + INTERVAL '1 month')::date
          WHERE subscription_id = $1
        RETURNING (CASE WHEN $4 THEN end_date - INTERVAL '1 month' ELSE ${BKK_TODAY} END)::date AS period_start, end_date AS period_end`,
        [sub.subscription_id, await statusId(client, 'Active'), plan.plan_id, sub.running]);
      const { period_start, period_end } = upd.rows[0];
      await client.query(
        `INSERT INTO subscription_payment (amount, subscription_id, paid_at, reference, period_start, period_end)
         VALUES ($1, $2, NOW(), $3, $4, $5)`,
        [plan.price, sub.subscription_id, reference || null, period_start, period_end]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    return SubscriptionModel.getForBusiness(businessId);
  }
};

module.exports = SubscriptionModel;
