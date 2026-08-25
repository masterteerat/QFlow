import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const QRScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
  const [errorMsg, setErrorMsg] = useState("");
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // เคลียร์ Error ทุกครั้งที่เปิด Modal
    setErrorMsg("");

    // 1. เช็ค Secure Context (แก้ปัญหากล้องไม่ขึ้นเวลาเทสมือถือผ่าน IP)
    const isSecureContext = window.isSecureContext || window.location.hostname === "localhost";
    if (!isSecureContext) {
      setErrorMsg(
        "เบราว์เซอร์บล็อกการใช้งานกล้อง เนื่องจากไม่ได้เชื่อมต่อผ่าน HTTPS หรือ localhost (Secure Context)"
      );
      return;
    }

    // 2. สร้าง instance ของ Html5Qrcode
    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    // 3. ดีเลย์ 300ms เพื่อหลบปัญหา React.StrictMode Mount/Unmount ชนกัน
    let startTimeout;
    const startScanner = () => {
      html5QrCode
        .start(
          { facingMode: "environment" }, // ใช้กล้องหลัง
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // สำเร็จ!
            onScanSuccess(decodedText);
            closeScanner();
          },
          (errorMessage) => {
            // error ระหว่างสแกนปกติ (เช่น ไม่เจอ QR ในเฟรม) เราจะปล่อยผ่านเงียบๆ
            // เพราะมันจะแจ้งเตือนรัวๆ ทุกเฟรมที่หา QR ไม่เจอ
          }
        )
        .catch((err) => {
          // ดักจับ Error ตอนขอ Permission หรือกล้องพัง
          setErrorMsg(`ไม่สามารถเปิดกล้องได้: ${err?.message || "กรุณาอนุญาตการเข้าถึงกล้อง"}`);
        });
    };

    startTimeout = setTimeout(startScanner, 300);

    // Cleanup function เมื่อปิด Modal หรือ Component Unmount
    return () => {
      clearTimeout(startTimeout);
      if (html5QrCode.isScanning) {
        html5QrCode
          .stop()
          .then(() => html5QrCode.clear())
          .catch((err) => console.error("Failed to clear html5Qrcode on unmount", err));
      } else {
        html5QrCode.clear();
      }
    };
  }, [isOpen]); // ทำงานใหม่เมื่อ isOpen เปลี่ยนแปลง

  // ฟังก์ชันสำหรับการอัปโหลดรูปภาพ
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setErrorMsg(""); // เคลียร์ error เก่าก่อน

    try {
      // ตรวจสอบว่ามี instance อยู่ไหม ถ้าไม่มีให้สร้างใหม่ (กรณีกล้องพังแต่จะใช้อัปโหลดแทน)
      const html5QrCode = scannerRef.current || new Html5Qrcode("reader");
      
      // สั่งสแกนจากไฟล์
      const decodedText = await html5QrCode.scanFile(file, true);
      
      onScanSuccess(decodedText);
      closeScanner();
    } catch (err) {
      // ดักจับ Error ตอนอ่านรูปภาพ (รูปเบลอ, ไม่ใช่ QR, แสงไม่พอ)
      setErrorMsg("อ่าน QR Code จากรูปไม่สำเร็จ กรุณาใช้รูปที่ชัดเจนกว่านี้");
      console.error("File Scan Error:", err);
    }
  };

  // ฟังก์ชันปิดกล้องและปิด Modal อย่างปลอดภัย
  const closeScanner = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current
        .stop()
        .then(() => {
          scannerRef.current.clear();
          onClose();
        })
        .catch((err) => {
          console.error("Failed to stop scanner", err);
          onClose();
        });
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={{ marginTop: 0 }}>สแกน QR Code</h2>

        {/* แสดง Error แบบชัดเจน */}
        {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}

        {/* พื้นที่สำหรับแสดงกล้อง (ต้องมี id="reader") */}
        <div id="reader" style={styles.readerContainer}></div>

        {/* ส่วนอัปโหลดรูปภาพ */}
        <div style={styles.uploadSection}>
          <p style={{ margin: "10px 0 5px" }}>หรืออัปโหลดรูปภาพ QR Code:</p>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileUpload} 
            style={{ width: "100%" }}
          />
        </div>

        <button onClick={closeScanner} style={styles.closeButton}>
          ปิด
        </button>
      </div>
    </div>
  );
};

// สไตล์เบื้องต้น (คุณสามารถเปลี่ยนไปใช้ Tailwind CSS หรือไฟล์ CSS ของคุณเองได้)
const styles = {
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex", justifyContent: "center", alignItems: "center",
    zIndex: 9999, padding: "20px"
  },
  modal: {
    backgroundColor: "#fff", padding: "20px", borderRadius: "8px",
    width: "100%", maxWidth: "400px", textAlign: "center"
  },
  readerContainer: {
    width: "100%", overflow: "hidden", borderRadius: "8px",
    backgroundColor: "#000", minHeight: "250px"
  },
  errorBox: {
    backgroundColor: "#ffebee", color: "#c62828",
    padding: "10px", borderRadius: "4px", marginBottom: "15px",
    fontSize: "14px", border: "1px solid #ffcdd2"
  },
  uploadSection: {
    marginTop: "15px", textAlign: "left", padding: "10px",
    backgroundColor: "#f5f5f5", borderRadius: "8px"
  },
  closeButton: {
    marginTop: "20px", padding: "10px 20px",
    backgroundColor: "#d32f2f", color: "#fff",
    border: "none", borderRadius: "4px", cursor: "pointer", width: "100%"
  }
};

export default QRScannerModal;