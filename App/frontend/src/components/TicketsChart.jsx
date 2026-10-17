import { BarChart, Bar, Cell, XAxis, YAxis, LabelList, ReferenceLine, Tooltip, ResponsiveContainer } from 'recharts';

// "Tickets per day, last 14 days", built to be read in a couple of seconds:
//   1. one plain-language headline  ("Busier than usual today")
//   2. three numbers under it       (today / yesterday / average)
//   3. bars with the count on top   (today = solid orange, busiest day = light orange, rest = grey)
//      and a dashed line for the daily average.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function DayTick({ x, y, payload, todayIso }) {
  const iso = payload.value;
  const isToday = iso === todayIso;
  const date = parseIso(iso);
  return (
    <g transform={`translate(${x},${y})`} className={isToday ? 'text-brand-700 dark:text-brand-300' : 'text-ink-500 dark:text-ink-400'}>
      <text y={14} textAnchor="middle" fill="currentColor" fontSize={isToday ? 11 : 10} fontWeight={isToday ? 800 : 500}>
        {isToday ? 'Today' : WEEKDAYS[date.getDay()]}
      </text>
      <text y={28} textAnchor="middle" fill="currentColor" fontSize={11} fontWeight={isToday ? 800 : 600}>
        {date.getDate()}
      </text>
    </g>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { iso, count } = payload[0].payload;
  const date = parseIso(iso);
  return (
    <div className="rounded-lg bg-ink-900 text-white text-xs px-3 py-2 shadow-xl">
      <p className="font-bold">{WEEKDAYS[date.getDay()]} {date.getDate()}/{date.getMonth() + 1}</p>
      <p className="text-brand-300 font-semibold">{count} {count === 1 ? 'ticket' : 'tickets'}</p>
    </div>
  );
}

export default function TicketsChart({ chartData = [] }) {
  const data = chartData.map((r, i) => {
    // `iso` comes from the API; fall back to counting back from today if an old backend is running
    let iso = r.iso;
    if (!iso) {
      const d = new Date();
      d.setDate(d.getDate() - (chartData.length - 1 - i));
      iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return { iso, count: Number(r.count) || 0 };
  });

  const total = data.reduce((sum, r) => sum + r.count, 0);

  if (data.length === 0 || total === 0) {
    return (
      <div className="bg-white dark:bg-ink-800 p-6 rounded-xl shadow-sm border border-ink-200 dark:border-ink-700 mb-8">
        <h3 className="font-display text-xl font-extrabold text-ink-900 dark:text-white">No tickets in the last 14 days</h3>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Once customers start joining your queue, you will see how busy each day was here.</p>
      </div>
    );
  }

  const todayItem = data[data.length - 1];
  const yesterday = data.length > 1 ? data[data.length - 2].count : 0;
  const earlier = data.slice(0, -1);
  const usual = earlier.length ? earlier.reduce((s, r) => s + r.count, 0) / earlier.length : 0;
  const avg = Math.round((total / data.length) * 10) / 10;
  const peak = data.reduce((best, r) => (r.count > best.count ? r : best), data[0]);
  const diff = todayItem.count - yesterday;

  // the one sentence the owner should take away
  let headline;
  let tone = 'text-ink-900 dark:text-white';
  if (todayItem.count === 0) {
    headline = 'No tickets yet today';
  } else if (usual > 0 && todayItem.count >= usual * 1.2) {
    headline = 'Busier than usual today';
    tone = 'text-brand-700 dark:text-brand-300';
  } else if (usual > 0 && todayItem.count <= usual * 0.8) {
    headline = 'Quieter than usual today';
  } else {
    headline = 'A normal day today';
  }

  const peakDate = parseIso(peak.iso);
  const peakIsToday = peak.iso === todayItem.iso;

  return (
    <div className="bg-white dark:bg-ink-800 p-5 sm:p-6 rounded-xl shadow-sm border border-ink-200 dark:border-ink-700 mb-8">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">Tickets per day · last 14 days</p>
      <h3 className={`font-display text-2xl sm:text-3xl font-extrabold mt-1 ${tone}`}>{headline}</h3>

      <dl className="grid grid-cols-3 gap-3 mt-4">
        <div>
          <dt className="text-xs font-semibold text-ink-500 dark:text-ink-400">Today</dt>
          <dd className="qnum text-3xl text-brand-700 dark:text-brand-300">{todayItem.count}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-ink-500 dark:text-ink-400">vs yesterday</dt>
          <dd className={`qnum text-3xl ${diff > 0 ? 'text-emerald-700 dark:text-emerald-400' : diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-ink-500 dark:text-ink-400'}`}>
            {diff > 0 ? `+${diff}` : diff < 0 ? `−${Math.abs(diff)}` : '0'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-ink-500 dark:text-ink-400">Average / day</dt>
          <dd className="qnum text-3xl text-ink-900 dark:text-white">{avg}</dd>
        </div>
      </dl>

      <div className="h-56 sm:h-64 w-full mt-5">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 4, bottom: 0, left: 4 }} barCategoryGap="18%">
            <XAxis dataKey="iso" interval={0} axisLine={false} tickLine={false} height={40} tick={<DayTick todayIso={todayItem.iso} />} />
            <YAxis hide domain={[0, (max) => Math.max(max, 3)]} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', opacity: 0.06 }} />
            <ReferenceLine
              y={avg}
              stroke="currentColor"
              strokeDasharray="4 4"
              className="text-ink-400 dark:text-ink-500"
              label={{ value: `avg ${avg}`, position: 'insideTopLeft', fontSize: 11, fontWeight: 700, className: 'fill-ink-500 dark:fill-ink-400' }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} minPointSize={3}>
              {data.map((r) => (
                <Cell
                  key={r.iso}
                  className={
                    r.iso === todayItem.iso
                      ? 'fill-brand-600 dark:fill-brand-500'
                      : r.iso === peak.iso
                      ? 'fill-brand-300 dark:fill-brand-700'
                      : 'fill-ink-200 dark:fill-ink-600'
                  }
                />
              ))}
              <LabelList dataKey="count" position="top" fontSize={12} fontWeight={800} className="fill-ink-800 dark:fill-ink-100" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-semibold text-ink-500 dark:text-ink-400">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-brand-600" />Today</span>
        {!peakIsToday && (
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-brand-300" />Busiest: {WEEKDAYS[peakDate.getDay()]} {peakDate.getDate()} ({peak.count})</span>
        )}
        <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-ink-400" />Daily average</span>
      </div>
    </div>
  );
}
