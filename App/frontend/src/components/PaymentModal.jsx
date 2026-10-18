import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../lib/api';
import { fmtMoney } from '../lib/money';

const fmtDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

// Small status pill for a shop's monthly fee. `sub` is the `subscription` object the API returns.
export function SubscriptionBadge({ sub }) {
  if (!sub) return null;
  const ok = sub.status === 'Active';
  const soon = ok && sub.days_left <= 7;
  const cls = !ok
    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
    : soon
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  const label = sub.status === 'Pending' ? 'Payment required'
    : sub.status === 'Expired' ? 'Fee expired'
    : `Paid · until ${fmtDate(sub.end_date)}`;
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${cls}`}>{label}</span>;
}

// DEMO payment of the monthly QFlow platform fee. The QR code is fake and no money moves:
// "I've paid" just tells the server the month is paid. Swap in a real payment provider before going live.
export default function PaymentModal({ shop, onClose, onPaid }) {
  const [sub, setSub] = useState(null);
  const [step, setStep] = useState('qr'); // 'qr' | 'processing' | 'done'
  const [error, setError] = useState('');
  const [reference] = useState(() => `QF-${shop.business_id}-${Date.now().toString(36).toUpperCase()}`);

  useEffect(() => {
    let alive = true;
    api.get(`/owner/businesses/${shop.business_id}/subscription`).then((res) => {
      if (alive && res.success) setSub(res.data.subscription);
    });
    return () => { alive = false; };
  }, [shop.business_id]);

  const price = sub?.price ?? 0;
  const renewing = sub?.status === 'Active';
  const qrValue = `QFLOW-DEMO-PAYMENT|ref=${reference}|shop=${shop.business_id}|amount=${price}|THB`;

  const pay = async () => {
    setError('');
    setStep('processing');
    await new Promise((r) => setTimeout(r, 1500)); // pretend the bank is confirming
    const res = await api.post(`/owner/businesses/${shop.business_id}/subscription/pay`, { reference });
    if (res.success) {
      setSub(res.data.subscription);
      setStep('done');
    } else {
      setError(res.message || 'Payment failed. Please try again.');
      setStep('qr');
    }
  };

  const finish = () => { onPaid?.(); onClose(); };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-ink-800 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
        {step === 'done' ? (
          <>
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-xl font-bold text-ink-900 dark:text-white mb-1">Payment received</h3>
            <p className="text-sm text-ink-500 dark:text-ink-400 mb-1"><strong>{shop.business_name}</strong> is now open to customers.</p>
            {sub && <p className="text-sm text-ink-500 dark:text-ink-400 mb-5">Paid until <strong>{fmtDate(sub.end_date)}</strong></p>}
            <button onClick={finish} className="w-full py-2.5 rounded-xl font-bold bg-brand-700 text-white hover:bg-brand-800">Done</button>
          </>
        ) : (
          <>
            <h3 className="text-xl font-bold text-ink-900 dark:text-white">{renewing ? 'Renew monthly fee' : 'Pay monthly fee'}</h3>
            <p className="text-sm text-ink-500 dark:text-ink-400 mt-1 mb-4">
              QFlow platform fee for <strong>{shop.business_name}</strong>
              {renewing && sub ? ` · adds one month after ${fmtDate(sub.end_date)}` : ''}
            </p>

            <p className="qnum text-4xl text-brand-700 dark:text-brand-300">฿{fmtMoney(price)}</p>
            <p className="text-xs text-ink-400 mb-4">per month · paid to QFlow</p>

            <div className="inline-block p-3 bg-white rounded-xl border border-ink-200">
              <QRCodeSVG value={qrValue} size={176} />
            </div>
            <p className="text-xs font-mono text-ink-500 dark:text-ink-400 mt-2">Ref {reference}</p>

            <p className="text-xs mt-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
              Demo only: this QR is fake and no real money is charged. Tap the button below to simulate paying.
            </p>

            {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}

            <div className="flex gap-3 mt-5">
              <button onClick={onClose} disabled={step === 'processing'} className="flex-1 py-2.5 rounded-xl font-semibold bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-200 hover:bg-ink-200 dark:hover:bg-ink-600 disabled:opacity-60">
                Pay later
              </button>
              <button onClick={pay} disabled={step === 'processing' || !sub} className="flex-1 py-2.5 rounded-xl font-bold bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-60">
                {step === 'processing' ? 'Confirming…' : "I've paid"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
