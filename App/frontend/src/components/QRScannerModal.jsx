import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const QRScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
  const [errorMsg, setErrorMsg] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  const scannerRef = useRef(null);
  const scanHandledRef = useRef(false);
  const startPromiseRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg("");
    setShowUpload(false);
    scanHandledRef.current = false;

    const isSecureContext =
      window.isSecureContext ||
      window.location.hostname === "localhost";

    if (!isSecureContext) {
      setErrorMsg(
        "Camera not available on HTTP. Use HTTPS, localhost, or upload an image below."
      );
      setShowUpload(true);
      return;
    }

    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        startPromiseRef.current = html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: {
              width: 250,
              height: 250,
            },
          },
          async (decodedText) => {
            // Prevent the same QR from being processed multiple times
            if (scanHandledRef.current) return;

            scanHandledRef.current = true;

            console.log("QR Code scanned:", decodedText);

            await closeScanner();

            onScanSuccess(decodedText);
          },
          () => {
            // Ignore scan errors while looking for a QR code
          }
        );

        await startPromiseRef.current;
      } catch (err) {
        console.error("Camera start error:", err);

        if (!scanHandledRef.current) {
          setErrorMsg(
            `Cannot open camera: ${
              err?.message || "Please allow camera access"
            }`
          );
          setShowUpload(true);
        }
      }
    };

    startScanner();

    return () => {
      cleanupScanner(html5QrCode);
    };
  }, [isOpen]);

  /**
   * Stop and clean up the QR scanner.
   */
  const cleanupScanner = async (scanner = scannerRef.current) => {
    if (!scanner) return;

    try {
      // If scanner is currently running, stop it first.
      if (scanner.isScanning) {
        await scanner.stop();
      }

      // Clear the scanner UI.
      scanner.clear();
    } catch (err) {
      console.error("Failed to clean up QR scanner:", err);
    }

    if (scannerRef.current === scanner) {
      scannerRef.current = null;
    }
  };

  /**
   * Close modal and stop camera.
   */
  const closeScanner = async () => {
    const scanner = scannerRef.current;

    if (!scanner) {
      onClose();
      return;
    }

    try {
      /*
       * If start() is still in progress, wait for it.
       * This prevents start() and stop()/clear() from racing.
       */
      if (startPromiseRef.current) {
        try {
          await startPromiseRef.current;
        } catch {
          // start() failed, nothing to stop
        }

        startPromiseRef.current = null;
      }

      if (scanner.isScanning) {
        await scanner.stop();
      }

      scanner.clear();
    } catch (err) {
      console.error("Failed to stop scanner:", err);
    } finally {
      scannerRef.current = null;
      onClose();
    }
  };

  /**
   * Scan a QR code from an uploaded image.
   */
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setErrorMsg("");
    scanHandledRef.current = false;

    try {
      /*
       * Stop camera first if it is running.
       */
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }

      /*
       * scanFile() doesn't require the camera scanner to be running.
       * Use a separate instance so camera and file scanning don't
       * interfere with each other.
       */
      const fileScanner = new Html5Qrcode("qr-file-scanner");

      const decodedText = await fileScanner.scanFile(file, true);

      console.log("QR Code from image:", decodedText);

      scanHandledRef.current = true;

      fileScanner.clear();

      onScanSuccess(decodedText);
      onClose();
    } catch (err) {
      console.error("File Scan Error:", err);

      setErrorMsg(
        "Failed to read QR from image. Please use a clearer QR Code image."
      );
    } finally {
      /*
       * Reset file input so the user can select the same file again.
       */
      event.target.value = "";
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Scan QR Code</h2>

        {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}

        {/* Camera scanner */}
        {!showUpload && (
          <div id="reader" style={styles.readerContainer}></div>
        )}

        {/* Hidden container used for image scanning */}
        <div
          id="qr-file-scanner"
          style={styles.hiddenScanner}
        />

        {/* Upload QR image */}
        <div style={styles.uploadSection}>
          <p style={styles.uploadTitle}>
            {showUpload
              ? "📷 Camera unavailable — upload a QR Code image:"
              : "Or upload a QR Code image:"}
          </p>

          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={styles.fileInput}
          />
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={closeScanner}
          style={styles.closeButton}
        >
          Close
        </button>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    padding: "20px",
  },

  modal: {
    backgroundColor: "#fff",
    padding: "20px",
    borderRadius: "8px",
    width: "100%",
    maxWidth: "400px",
    textAlign: "center",
  },

  title: {
    marginTop: 0,
    marginBottom: "15px",
  },

  readerContainer: {
    width: "100%",
    overflow: "hidden",
    borderRadius: "8px",
    backgroundColor: "#000",
    minHeight: "250px",
  },

  /*
   * html5-qrcode needs an element to exist for scanFile().
   * It doesn't need to be visible to the user.
   */
  hiddenScanner: {
    display: "none",
  },

  errorBox: {
    backgroundColor: "#fff3e0",
    color: "#e65100",
    padding: "12px",
    borderRadius: "4px",
    marginBottom: "15px",
    fontSize: "14px",
    border: "1px solid #ffe0b2",
    textAlign: "left",
  },

  uploadSection: {
    marginTop: "15px",
    textAlign: "left",
    padding: "10px",
    backgroundColor: "#f5f5f5",
    borderRadius: "8px",
  },

  uploadTitle: {
    margin: "10px 0 5px",
    fontWeight: 600,
  },

  fileInput: {
    width: "100%",
    padding: "8px",
    borderRadius: "4px",
    border: "1px solid #ddd",
    background: "#fff",
  },

  closeButton: {
    marginTop: "20px",
    padding: "10px 20px",
    backgroundColor: "#d32f2f",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    width: "100%",
  },
};

export default QRScannerModal;