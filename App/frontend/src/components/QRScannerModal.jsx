import { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function QRScannerModal({ onClose, onScanSuccess }) {
  useEffect(() => {
    // กำหนดค่า scanner ให้อ่านไวและครอบคลุม
    const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    
    scanner.render((text) => {
      onScanSuccess(text);
      scanner.clear();
    }, (error) => {
      // ignore scanning background errors
    });

    return () => { 
      scanner.clear().catch(() => {}); 
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl max-w-md w-full transition-colors duration-300">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-white text-lg">Scan QR Code to Check-in</h3>
          <button onClick={onClose} className="text-3xl font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 leading-none">&times;</button>
        </div>
        
        {/* กล่องแสดงกล้อง */}
        <div id="qr-reader" className="overflow-hidden rounded-lg bg-white [&>div]:border-none"></div>
        
        <button onClick={onClose} className="mt-6 w-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-3 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}