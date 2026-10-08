import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getCustomer } from '../lib/auth';

function formatLeft(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d > 0 ? `${d}d ` : ''}${pad(h)}:${pad(m)}:${pad(sec)}`;
}

// Shows a red "banned" banner with a live countdown. Renders nothing for customers who are not banned.
export default function BanNotice() {
  const customer = getCustomer();
  const [ban, setBan] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Load now and re-check every minute (the ban may have been lifted or extended)
  useEffect(() => {
    if (!customer?.id) return undefined;
    let cancelled = false;
    const load = async () => {
      const res = await api.get('/customer/ban-status');
      if (cancelled || !res.success) return;
      if (res.banned) {
        setBan(res);
        setSecondsLeft(res.permanent ? 0 : res.seconds_left);
      } else {
        setBan(null);
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [customer?.id]);

  // Tick every second; when the countdown ends, hide the banner
  useEffect(() => {
    if (!ban || ban.permanent) return undefined;
    const id = setInterval(() => {
      setSecondsLeft((v) => {
        if (v <= 1) { setBan(null); return 0; }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [ban]);

  if (!ban) return null;

  return (
    <div className="max-w-3xl mx-auto px-5 pt-4">
      <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" role="alert">
        <div>
          <p className="font-bold">You are banned from booking <span className="font-normal">({ban.tier_name})</span></p>
          <p className="text-sm">
            {ban.permanent
              ? 'This ban is permanent because of repeated no-shows.'
              : 'You missed a booked queue. You can book again when the timer ends.'}
          </p>
        </div>
        {!ban.permanent && (
          <div className="text-right shrink-0">
            <p className="text-xs uppercase tracking-wide opacity-80">Time left</p>
            <p className="text-2xl font-mono font-bold">{formatLeft(secondsLeft)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
