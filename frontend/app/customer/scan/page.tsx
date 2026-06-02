"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import {
  Camera, QrCode, RefreshCw, CheckCircle2, XCircle,
  Keyboard, ChevronDown, AlertTriangle, Info,
} from "lucide-react";

// ── QR format constants ───────────────────────────────────────────────────────

const DEEP_LINK_SCHEME = "restaurant-os://table";
const WEB_HOSTS = ["dineluxe.app", "www.dineluxe.app"];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedQR {
  branchId: string;
  tableId: string;
  tableLabel: string;
}

type ScanState =
  | "idle"          // waiting to start
  | "scanning"      // camera active
  | "success"       // valid QR found
  | "error";        // invalid or permission error

type ErrorKind =
  | "permission_denied"
  | "invalid_qr"
  | "table_not_found"
  | "camera_unavailable"
  | "network_error";

// ── QR parser ─────────────────────────────────────────────────────────────────

function parseQRCode(raw: string): ParsedQR | null {
  try {
    // Format A: restaurant-os://table?branch=X&table=Y&table_label=Z
    if (raw.startsWith(DEEP_LINK_SCHEME)) {
      const qs = raw.slice(DEEP_LINK_SCHEME.length).replace(/^\?/, "");
      const params = new URLSearchParams(qs);
      const branchId = params.get("branch");
      const tableId = params.get("table");
      const tableLabel = params.get("table_label") ?? params.get("table") ?? "";
      if (branchId && tableId) return { branchId, tableId, tableLabel };
      return null;
    }

    // Format B: https://dineluxe.app/order?branch=X&table=Y&table_label=Z
    const url = new URL(raw);
    if (WEB_HOSTS.includes(url.hostname)) {
      const branchId = url.searchParams.get("branch");
      const tableId = url.searchParams.get("table");
      const tableLabel = url.searchParams.get("table_label") ?? url.searchParams.get("table") ?? "";
      if (branchId && tableId) return { branchId, tableId, tableLabel };
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

// ── Permission guide steps ────────────────────────────────────────────────────

const PERMISSION_STEPS = [
  { step: 1, text: "Tap the lock icon in your browser's address bar" },
  { step: 2, text: "Find \"Camera\" in the permissions list" },
  { step: 3, text: "Change permission from \"Blocked\" to \"Allow\"" },
  { step: 4, text: "Refresh this page and try again" },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function CustomerScanPage() {
  const router = useRouter();

  // Core scan state
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [parsedQR, setParsedQR] = useState<ParsedQR | null>(null);

  // Manual entry state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBranchId, setManualBranchId] = useState("");
  const [manualTableCode, setManualTableCode] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrScannerRef = useRef<any>(null);
  const scannerDivId = "qr-reader";

  // ── Camera permission check ────────────────────────────────────────────────
  useEffect(() => {
    checkCameraPermission();
    return () => stopScanning();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach((t) => t.stop());
      setHasPermission(true);
    } catch (err: any) {
      const isDenied =
        err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
      setHasPermission(false);
      setErrorKind(isDenied ? "permission_denied" : "camera_unavailable");
      setScanState("error");
    }
  };

  // ── Stop all scanning ─────────────────────────────────────────────────────
  const stopScanning = useCallback(() => {
    // Stop html5-qrcode scanner if active
    if (qrScannerRef.current) {
      try { qrScannerRef.current.stop?.(); } catch { /* ignore */ }
      qrScannerRef.current = null;
    }
    // Stop raw camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    // Clear BarcodeDetector polling
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setScanState("idle");
  }, []);

  // ── Handle a decoded QR string ────────────────────────────────────────────
  const handleDecodedQR = useCallback(async (raw: string) => {
    stopScanning();

    const parsed = parseQRCode(raw.trim());
    if (!parsed) {
      setErrorKind("invalid_qr");
      setScanState("error");
      return;
    }

    // Brief success animation before navigating
    setParsedQR(parsed);
    setScanState("success");

    // Navigate after 1.2s so user sees the checkmark
    setTimeout(() => {
      const qs = new URLSearchParams({
        branch: parsed.branchId,
        table: parsed.tableId,
        table_label: parsed.tableLabel,
      });
      router.push(`/customer/order?${qs.toString()}`);
    }, 1200);
  }, [stopScanning, router]);

  // ── Start scanning — try html5-qrcode first, fall back to BarcodeDetector ─
  const startScanning = useCallback(async () => {
    if (!hasPermission) return;
    setScanState("scanning");
    setErrorKind(null);

    // ── Strategy 1: html5-qrcode (most reliable, works on all browsers) ────
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(scannerDivId);
      qrScannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText: string) => { handleDecodedQR(decodedText); },
        () => { /* scan still in progress — suppress per-frame errors */ },
      );
      return; // successfully started — nothing more to do
    } catch (importErr) {
      // html5-qrcode not available or failed — fall through to BarcodeDetector
      qrScannerRef.current = null;
    }

    // ── Strategy 2: BarcodeDetector (Chrome / Edge on HTTPS) ───────────────
    if ("BarcodeDetector" in window) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });


        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              handleDecodedQR(barcodes[0].rawValue);
            }
          } catch { /* detection frame error — keep polling */ }
        }, 300);

        return;
      } catch (streamErr: any) {
        streamRef.current = null;
        const isDenied =
          streamErr?.name === "NotAllowedError" || streamErr?.name === "PermissionDeniedError";
        setHasPermission(false);
        setErrorKind(isDenied ? "permission_denied" : "camera_unavailable");
        setScanState("error");
        return;
      }
    }

    // ── Strategy 3: No scanner available ───────────────────────────────────
    setErrorKind("camera_unavailable");
    setScanState("error");
  }, [hasPermission, handleDecodedQR]);

  // ── Manual table lookup ───────────────────────────────────────────────────
  const handleManualLookup = async () => {
    if (!manualBranchId.trim() || !manualTableCode.trim()) {
      setManualError("Please enter both Branch ID and Table Code.");
      return;
    }
    setManualLoading(true);
    setManualError(null);
    try {
      const result = await apiClient.post<{ table_id: string; label: string }>(
        "/tables/lookup-by-label",
        { branch_id: manualBranchId.trim(), label: manualTableCode.trim().toUpperCase() },
      );
      if (!result?.table_id) {
        setManualError("Table not found. Check the code and try again.");
        return;
      }
      const qs = new URLSearchParams({
        branch: manualBranchId.trim(),
        table: result.table_id,
        table_label: result.label ?? manualTableCode.trim().toUpperCase(),
      });
      router.push(`/customer/order?${qs.toString()}`);
    } catch (err: any) {
      if (err?.status === 404) {
        setManualError("Table not found. Please check the code and try again.");
      } else {
        setManualError("Network error. Please check your connection and try again.");
      }
    } finally {
      setManualLoading(false);
    }
  };

  // ── Error display helper ──────────────────────────────────────────────────
  const renderError = () => {
    if (errorKind === "permission_denied") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-500 shrink-0" />
            <p className="font-semibold text-amber-800 text-sm">Camera Access Required</p>
          </div>
          <p className="text-amber-700 text-sm">
            DineLuxe needs camera access to scan QR codes at your table.
            Follow these steps to enable it:
          </p>
          <ol className="space-y-2">
            {PERMISSION_STEPS.map(({ step, text }) => (
              <li key={step} className="flex items-start gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center mt-0.5">
                  {step}
                </span>
                <span className="text-amber-700 text-sm">{text}</span>
              </li>
            ))}
          </ol>
          <Button
            onClick={checkCameraPermission}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
          >
            <RefreshCw size={15} className="mr-2" />
            I've Enabled Camera — Try Again
          </Button>
        </motion.div>
      );
    }

    if (errorKind === "invalid_qr") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3"
        >
          <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">Not a DineLuxe QR code</p>
            <p className="text-red-600 text-xs mt-1">
              This QR code is not from DineLuxe. Please scan the QR code on your table or at the restaurant entrance.
            </p>
          </div>
        </motion.div>
      );
    }

    if (errorKind === "table_not_found") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3"
        >
          <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">Table Not Found</p>
            <p className="text-red-600 text-xs mt-1">
              This table could not be found. Please try scanning again or ask restaurant staff for help.
            </p>
          </div>
        </motion.div>
      );
    }

    if (errorKind === "camera_unavailable") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-start gap-3"
        >
          <Info size={18} className="text-gray-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-800 text-sm">Camera Not Available</p>
            <p className="text-gray-600 text-xs mt-1">
              Your browser does not support QR scanning. Please use manual entry below.
            </p>
          </div>
        </motion.div>
      );
    }

    return null;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <PageWrapper title="Scan QR Code" subtitle="Scan the table QR code to start ordering">
      <div className="space-y-5 pb-6">

        {/* ── Scanner viewport ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative aspect-square max-w-sm mx-auto rounded-3xl overflow-hidden bg-gray-900 shadow-xl"
        >
          {/* html5-qrcode mounts here — hidden but required in DOM */}
          <div
            id={scannerDivId}
            className={[
              "absolute inset-0 w-full h-full",
              scanState === "scanning" && !streamRef.current ? "block" : "hidden",
            ].join(" ")}
          />

          {/* BarcodeDetector raw video */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={[
              "absolute inset-0 w-full h-full object-cover",
              scanState === "scanning" && streamRef.current ? "block" : "hidden",
            ].join(" ")}
          />
          {/* Hidden canvas for frame capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* ── Idle state ─────────────────────────────────────────────── */}
          {scanState === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-6"
              >
                <QrCode size={48} className="text-white" />
              </motion.div>
              <p className="text-white text-center font-semibold">Point camera at QR code</p>
              <p className="text-white/60 text-sm text-center mt-2">
                The QR code is on your table or at the restaurant entrance
              </p>
            </div>
          )}

          {/* ── Scanning state overlay ──────────────────────────────────── */}
          {scanState === "scanning" && (
            <>
              {/* Corner guides */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-56 h-56 relative">
                  {/* Top-left */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#E8A020] rounded-tl-lg" />
                  {/* Top-right */}
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#E8A020] rounded-tr-lg" />
                  {/* Bottom-left */}
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#E8A020] rounded-bl-lg" />
                  {/* Bottom-right */}
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#E8A020] rounded-br-lg" />
                </div>
              </div>

              {/* Scanning laser line */}
              <motion.div
                animate={{ y: ["15%", "85%", "15%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
className="absolute left-[12%] right-[12%] h-0.5 bg-linear-to-r from-transparent via-[#E8A020] to-transparent opacity-90 pointer-events-none"
              />

              {/* Instruction */}
              <div className="absolute bottom-6 left-0 right-0 text-center">
                <p className="text-white text-sm font-medium">Align QR code within the frame</p>
              </div>

              {/* Cancel */}
              <button
                onClick={stopScanning}
                className="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-bold text-lg hover:bg-white/30 transition-colors"
                aria-label="Stop scanning"
              >
                ✕
              </button>
            </>
          )}

          {/* ── Success animation ────────────────────────────────────────── */}
          <AnimatePresence>
            {scanState === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-green-900/90 flex flex-col items-center justify-center gap-4"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                >
                  <CheckCircle2 size={80} className="text-green-400" strokeWidth={1.5} />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-center"
                >
                  <p className="text-white font-bold text-lg">QR Code Scanned!</p>
                  {parsedQR?.tableLabel && (
                    <p className="text-green-300 text-sm mt-1">
                      Table {parsedQR.tableLabel} — opening menu…
                    </p>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Error messages ────────────────────────────────────────────── */}
        {scanState === "error" && errorKind && renderError()}

        {/* ── Retry / Start button ──────────────────────────────────────── */}
        {scanState !== "success" && hasPermission && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            {scanState === "scanning" ? (
              <Button
                onClick={stopScanning}
                variant="outline"
                className="w-full h-14 rounded-2xl text-base font-semibold border-2"
              >
                Stop Scanning
              </Button>
            ) : (
              <Button
                onClick={startScanning}
                className="w-full h-14 bg-[#1A3C5E] hover:bg-[#1A3C5E]/90 text-white font-semibold text-base rounded-2xl shadow-lg"
              >
                <Camera size={20} className="mr-2" />
                {hasPermission === null ? "Checking camera…" : (
                  scanState === "error" && errorKind !== "permission_denied" && errorKind !== "camera_unavailable"
                    ? "Try Again"
                    : "Start Scanning"
                )}
              </Button>
            )}
          </motion.div>
        )}

        {/* ── Manual entry section ──────────────────────────────────────── */}
        {scanState !== "scanning" && scanState !== "success" && (
          <div>
            <button
              onClick={() => setShowManualEntry((v) => !v)}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors py-1"
            >
              <Keyboard size={14} />
              Can't scan? Enter table code manually
              <motion.span
                animate={{ rotate: showManualEntry ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={14} />
              </motion.span>
            </button>

            <AnimatePresence>
              {showManualEntry && (
                <motion.div
                  key="manual-entry"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-3">
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                      <p className="text-xs text-gray-500 font-medium">
                        Ask restaurant staff for your Branch ID and Table Code
                      </p>

                      {/* Branch ID */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">
                          Branch ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 550e8400-e29b-41d4-a716-..."
                          value={manualBranchId}
                          onChange={(e) => { setManualBranchId(e.target.value); setManualError(null); }}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A020]/50 transition-all"
                        />
                      </div>

                      {/* Table code */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">
                          Table Code
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. T3, VIP1, B2"
                          value={manualTableCode}
                          onChange={(e) => { setManualTableCode(e.target.value); setManualError(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleManualLookup(); }}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A020]/50 transition-all"
                        />
                      </div>

                      {/* Manual error */}
                      {manualError && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-red-500 text-xs flex items-center gap-1.5"
                        >
                          <XCircle size={12} />
                          {manualError}
                        </motion.p>
                      )}

                      <Button
                        onClick={handleManualLookup}
                        disabled={manualLoading || !manualBranchId.trim() || !manualTableCode.trim()}
                        className="w-full bg-[#E8A020] hover:bg-[#E8A020]/90 text-white rounded-xl h-11 font-semibold text-sm"
                      >
                        {manualLoading ? (
                          <span className="flex items-center gap-2">
                            <motion.span
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                              className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                            />
                            Looking up table…
                          </span>
                        ) : (
                          "Find My Table"
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Scanning tips ─────────────────────────────────────────────── */}
        {scanState !== "success" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-50 rounded-2xl p-4"
          >
            <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <Info size={14} className="text-gray-400" />
              Scanning Tips
            </h3>
            <ul className="text-sm text-gray-500 space-y-2">
              {[
                "Hold your phone steady while scanning",
                "Make sure the QR code is well-lit",
                "The QR code should fill ~30% of the frame",
                "Clean your camera lens for better scanning",
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <span className="text-[#E8A020] mt-0.5">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </motion.div>
        )}

      </div>
    </PageWrapper>
  );
}