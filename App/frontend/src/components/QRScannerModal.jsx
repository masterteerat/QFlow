import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const QRScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
  const [errorMsg, setErrorMsg] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg("");
    setShowUpload(false);

    const isSecureContext = window.isSecureContext || window.location.hostname === "localhost";
    if (!isSecureContext) {
      setErrorMsg(
        "Camera not available on HTTP. Use HTTPS, localhost, or upload an image below."
      );
      setShowUpload(true);
      return;
    }

    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    let startTimeout;
    const startScanner = () => {
      html5QrCode
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onScanSuccess(decodedText);
            closeScanner();
          },
          (errorMessage) => {
            // Ignore scan errors (no QR in frame)
          }
        )
        .catch((err) => {
          setErrorMsg(`Cannot open camera: ${err?.message || "Please allow camera access"}`);
          setShowUpload(true);
        });
    };

    startTimeout = setTimeout(startScanner, 300);

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
  }, [isOpen]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setErrorMsg("");

    try {
      const html5QrCode = scannerRef.current || new Html5Qrcode("reader");
      const decodedText = await html5Qrcode.scanFile(file, true);
      onScanSuccess(decodedText);
      closeScanner();
    } catch (err) {
      setErrorMsg("Failed to read QR from image. Please use a clearer image.");
      console.error("File Scan Error:", err);
    }
  };

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
        <h2 style={{ marginTop: 0 }}>Scan QR Code</h2>

        {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}

        {!showUpload && (
          <div id="reader" style={styles.readerContainer}></div>
        )}

        <div style={styles.uploadSection}>
          <p style={{ margin: "10px 0 5px", fontWeight: 600 }}>
            {showUpload ? "📷 Camera unavailable — upload a QR Code image:" : "Or upload a QR Code image:"}
          </p>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileUpload} 
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd", background: "#fff" }}
          />
        </div>

        <button onClick={closeScanner} style={styles.closeButton}>
          Close
        </button>
      </div>
    </div>
  );
};

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
    backgroundColor: "#fff3e0", color: "#e65100",
    padding: "12px", borderRadius: "4px", marginBottom: "15px",
    fontSize: "14px", border: "1px solid #ffe0b2",
    textAlign: "left"
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