const pool = require('../config/db');

// whitelist ชื่อตาราง ห้ามเอาค่าจาก user มาต่อ SQL ตรง ๆ
const USER_TABLE = {
  customer: { table: 'customer', pk: 'customer_id' },
  owner:    { table: 'owner',    pk: 'owner_id' },
};

const cache = new Map(); // key: "role:id" -> { perms:Set, exp }
const TTL = 60 * 1000;

async function loadPermissions(role, id) {
  const key = `${role}:${id}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.perms;

  const { table, pk } = USER_TABLE[role];

  // FIX: บัญชีที่สมัครตอนที่ตาราง role ยังว่าง (หรือก่อนมี RBAC) จะมี role_id = NULL
  // แล้วได้ 403 Forbidden ทุก route (รวมถึงตอนกด "Register shop").
  // ตอนนี้ถ้า u.role_id เป็น NULL จะ fallback ไปใช้ role ตามชื่อใน JWT ($2) แทน
  const { rows } = await pool.query(
    `SELECT DISTINCT o.obj_name, p.action
       FROM ${table} u
       LEFT JOIN user_group g ON g.group_id = u.group_id
       JOIN role_permission rp ON rp.role_id IN (
              COALESCE(u.role_id, (SELECT r.role_id FROM role r WHERE r.role_name = $2)),
              g.role_id
            )
       JOIN permission p ON p.permission_id = rp.permission_id
       JOIN object o ON o.obj_id = p.obj_id
      WHERE u.${pk} = $1`,
    [id, role]
  );
  const perms = new Set(rows.map(r => `${r.obj_name}:${r.action}`));
  cache.set(key, { perms, exp: Date.now() + TTL });
  return perms;
}

// เรียกหลังเปลี่ยน role/group ของ user เพื่อให้มีผลทันที (ไม่ต้องรอ TTL)
function invalidatePermissions(role, id) {
  cache.delete(`${role}:${id}`);
}

// ต้อง login (มี JWT ที่ verify ผ่าน และ role อยู่ใน whitelist)
function requireAuth(req, res, next) {
  if (!req.user?.id || !USER_TABLE[req.user.role]) {
    return res.status(401).json({ success: false, message: 'Please log in again.' });
  }
  next();
}

// จำกัดว่า token ต้องเป็น role ไหน (กัน customer token เรียก owner route และกลับกัน)
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ success: false, message: 'Forbidden' });

// :id ใน URL ต้องตรงกับคนที่ login อยู่
const requireSelf = (param = 'id') => (req, res, next) =>
  String(req.params[param]) === String(req.user?.id)
    ? next()
    : res.status(403).json({ success: false, message: 'Forbidden' });

const requirePermission = (obj, action) => async (req, res, next) => {
  try {
    const perms = await loadPermissions(req.user.role, req.user.id);
    if (!perms.has(`${obj}:${action}`)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  } catch (e) {
    console.error('RBAC error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// business ใน URL ต้องเป็นของ owner ที่ login อยู่จริง
const requireBusinessOwner = (param = 'businessId') => async (req, res, next) => {
  const businessId = Number(req.params[param]);
  if (!Number.isInteger(businessId)) {
    return res.status(400).json({ success: false, message: 'Invalid business id.' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT 1 FROM business WHERE business_id = $1 AND owner_id = $2 AND is_active',
      [businessId, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  } catch (e) {
    console.error('Business owner check error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  requireAuth,
  requireRole,
  requireSelf,
  requirePermission,
  requireBusinessOwner,
  invalidatePermissions,
};
