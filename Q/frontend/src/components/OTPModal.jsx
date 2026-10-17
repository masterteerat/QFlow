import { useState, useEffect, useRef } from 'react';

const OTPModal = ({ isOpen, onClose, onVerify, email, onResend }) => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputsRef = useRef([]);

  useEffect(() => {
    if (isOpen) {
      setOtp('');
      setError('');
      setTimeout(() => inputsRef.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value) || value.length > 1) return;
    // keep each digit in its own position (empty boxes are spaces) so typing out of order can't shift digits
    const newOtp = otp.padEnd(6, ' ').split('');
    newOtp[index] = value || ' ';
    setOtp(newOtp.join('').trimEnd());
    if (value && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !(otp[index] || '').trim() && index > 0) {
      const prev = otp.padEnd(6, ' ').split('');
      prev[index - 1] = ' ';
      setOtp(prev.join('').trimEnd());
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    setOtp(pasted);
    if (pasted.length === 6) inputsRef.current[5]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) return setError('Please enter the full 6-digit code');
    setError('');
    setLoading(true);
    try {
      await onVerify(email, otp);
    } catch (err) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await onResend(email);
      setResendCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to resend OTP');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-ink-800 rounded-3xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-ink-100 dark:border-ink-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-ink-800 dark:text-white">Verify Your Email</h2>
          <button onClick={onClose} className="text-ink-400 dark:text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6">
          <p className="text-ink-600 dark:text-ink-300 mb-4 text-center">
            We sent a 6-digit code to <strong>{email}</strong>. Enter it below to complete login.
          </p>

          {error && <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded mb-4 text-sm border border-rose-200 dark:border-rose-800">{error}</div>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <input
                  key={i}
                  ref={(el) => inputsRef.current[i] = el}
                  type="text"
                  maxLength={1}
                  value={(otp[i] || '').trim()}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-11 h-14 text-center qnum text-2xl border-2 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 bg-white dark:bg-ink-700 dark:text-white border-ink-300 dark:border-ink-600"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || !/^\d{6}$/.test(otp)}
              className="w-full py-3.5 bg-brand-700 dark:bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-800 dark:hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="w-full py-2 text-sm text-ink-600 dark:text-ink-400 hover:text-brand-700 dark:hover:text-brand-400 disabled:opacity-50"
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive it? Resend code"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OTPModal;