// 100.00 -> "100", 49.5 -> "49.5", 1234 -> "1,234"
export const fmtMoney = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
