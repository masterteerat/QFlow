import { useEffect, useState } from 'react';
import { api } from './api';

// True only when the server says Quick Login is enabled (ENABLE_DEV_LOGIN=true and not production).
export default function useDevLogin() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    api.get('/config').then((d) => { if (alive) setEnabled(Boolean(d && d.devLogin)); });
    return () => { alive = false; };
  }, []);
  return enabled;
}
