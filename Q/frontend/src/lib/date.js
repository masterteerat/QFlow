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
