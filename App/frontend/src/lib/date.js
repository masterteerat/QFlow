// All dates in QFlow are Bangkok dates. Keep them as 'YYYY-MM-DD' strings and never
// pass them through `new Date('YYYY-MM-DD')` (that parses as UTC and can shift the day).
export const bkkToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());

// 'YYYY-MM-DD' -> 'DD/MM/YYYY'
export const fmtDate = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '-';
};

// Local Date object for a Bangkok 'YYYY-MM-DD' (midnight, for calendar math only)
export const ymdToLocalDate = (ymd) => {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

// ---- calendar helpers (pure 'YYYY-MM-DD' string math, no timezone surprises) ----
const pad2 = (n) => String(n).padStart(2, '0');
export const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`; // m is 1-12
export const parseYmd = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
};
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-12
export const weekdayOf = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
export const addDaysYmd = (s, n) => {
  const p = parseYmd(s);
  if (!p) return s;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const monthName = (m) => MONTHS[m - 1];
// 'Mon, 19 Oct 2026'
export const fmtDateLong = (s) => {
  const p = parseYmd(s);
  if (!p) return '-';
  return `${WEEKDAYS[weekdayOf(p.y, p.m, p.d)].slice(0, 3)}, ${p.d} ${MONTHS[p.m - 1].slice(0, 3)} ${p.y}`;
};

// 'DD/MM HH:MM' of (date + time - minutes). Used for the "free cancellation until ..." hint.
export const minusMinutesLabel = (dateStr, timeStr, mins) => {
  const p = parseYmd(dateStr);
  if (!p) return '-';
  const [h, m] = String(timeStr).split(':').map(Number);
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d, h || 0, m || 0) - Number(mins || 0) * 60000);
  return `${pad2(dt.getUTCDate())}/${pad2(dt.getUTCMonth() + 1)} ${pad2(dt.getUTCHours())}:${pad2(dt.getUTCMinutes())}`;
};
// 'T00:30' style ISO ('2026-10-19T23:00', from the API) -> 'DD/MM HH:MM'
export const fmtDeadline = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : '-';
};
