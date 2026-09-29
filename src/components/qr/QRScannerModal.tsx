import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Camera, Upload, CheckCircle2, AlertTriangle, XCircle, RefreshCw, KeyRound, Sparkles, Volume2, ShieldCheck 
} from 'lucide-react';
import jsQR from 'jsqr';
import { api } from '../../services/api.ts';
import { QRVerifyResult, GFCEvent } from '../../types/index.ts';
import { playChime } from '../../utils/qr.ts';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetEventId?: string;
  onCheckInSuccess?: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  targetEventId,
  onCheckInSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'file' | 'manual'>('camera');
  const [events, setEvents] = useState<GFCEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(targetEventId || '');
  const [scanning, setScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<QRVerifyResult | null>(null);
  const [manualCode, setManualCode] = useState<string>('');
  const [recentScans, setRecentScans] = useState<{ id: string; name: string; time: string; status: string }[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Load events list for the target selector
  useEffect(() => {
    if (isOpen) {
      api.getEvents({ status: 'published' }).then(setEvents).catch(console.error);
      if (targetEventId) setSelectedEventId(targetEventId);
    }
  }, [isOpen, targetEventId]);

  // Start / Stop Camera Stream
  useEffect(() => {
    if (!isOpen || activeTab !== 'camera') {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setScanning(true);
        requestAnimationFrame(tick);
      }
    } catch (err: any) {
      console.warn('Camera access could not be initialized:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access or use the Image Upload / Manual Entry options.'
          : 'Could not access camera device. Please use Image Upload or Manual Entry.'
      );
      setScanning(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const tick = () => {
    if (!videoRef.current || !canvasRef.current) return;

    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data && !verifying) {
          handleScannedData(code.data);
          // Pause camera detection briefly so we don't spam requests
          setTimeout(() => {
            if (isOpen && activeTab === 'camera') {
              animationFrameRef.current = requestAnimationFrame(tick);
            }
          }, 1500);
          return;
        }
      }
    }

    if (isOpen && activeTab === 'camera') {
      animationFrameRef.current = requestAnimationFrame(tick);
    }
  };

  const handleScannedData = async (payload: string) => {
    if (verifying) return;
    setVerifying(true);

    try {
      const result = await api.verifyQRCode(payload, selectedEventId || undefined);
      setLastResult(result);

      if (result.valid && result.status === 'success') {
        playChime('success');
        if (result.attendee) {
          setRecentScans((prev) => [
            {
              id: result.attendee!.id,
              name: result.attendee!.attendeeName,
              time: new Date().toLocaleTimeString(),
              status: 'Checked In',
            },
            ...prev.slice(0, 4),
          ]);
        }
        if (onCheckInSuccess) onCheckInSuccess();
      } else if (result.status === 'already_checked_in') {
        playChime('warning');
      } else {
        playChime('error');
      }
    } catch (err: any) {
      playChime('error');
      setLastResult({
        valid: false,
        status: 'error',
        message: err.message || 'Error processing QR Code validation.',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          handleScannedData(code.data);
        } else {
          playChime('error');
          setLastResult({
            valid: false,
            status: 'invalid_ticket',
            message: 'No readable QR code found in the uploaded image. Please try another photo or enter the code manually.',
          });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScannedData(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base">GFC Event QR Scanner</h3>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-mono">
                  LIVE CHECK-IN
                </span>
              </div>
              <p className="text-xs text-slate-300">Scan event attendance QR ticket & validate in real-time</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Event Context Selection */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3 shrink-0">
          <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Filter Event:</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Any Active GFC Event (Universal Check-In)</option>
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.title} ({evt.date})
              </option>
            ))}
          </select>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 bg-white shrink-0 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'camera'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-4 h-4" />
            Live Camera
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'file'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload QR Image
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'manual'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Manual Code
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center">
          {activeTab === 'camera' && (
            <div className="w-full flex flex-col items-center">
              <div className="relative w-full aspect-video sm:aspect-square max-w-[340px] bg-slate-950 rounded-2xl overflow-hidden shadow-inner border-2 border-indigo-400/40 flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Animated viewfinder overlay */}
                {scanning && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-48 h-48 border-2 border-dashed border-indigo-400 rounded-xl relative shadow-lg">
                      {/* Corner marks */}
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-indigo-400 -mt-1 -ml-1"></div>
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-indigo-400 -mt-1 -mr-1"></div>
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-indigo-400 -mb-1 -ml-1"></div>
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-indigo-400 -mb-1 -mr-1"></div>
                      {/* Scanning laser line */}
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_8px_#818cf8] animate-pulse absolute top-1/2 -translate-y-1/2"></div>
                    </div>
                    <span className="text-[11px] text-white/80 font-medium mt-3 bg-black/50 px-3 py-1 rounded-full backdrop-blur-xs">
                      Align attendee QR ticket in frame
                    </span>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 bg-slate-900/90 p-5 flex flex-col items-center justify-center text-center text-white">
                    <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
                    <p className="text-xs text-slate-200 leading-relaxed mb-3">{cameraError}</p>
                    <button
                      onClick={startCamera}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-medium"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry Camera
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'file' && (
            <div className="w-full flex flex-col items-center">
              <label className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50 hover:bg-indigo-50/30">
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3 shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">Select or drop QR image</p>
                <p className="text-xs text-slate-500 mt-1">PNG, JPG, or Screenshot of GFC Event Ticket</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="w-full space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Attendee Ticket Code or QR String:
                </label>
                <input
                  type="text"
                  placeholder="e.g. GFC-EVT101-78912"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim() || verifying}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                Validate & Check In Ticket
              </button>
            </form>
          )}

          {/* Validation Result Feedback Card */}
          {lastResult && (
            <div
              className={`w-full mt-5 p-4 rounded-xl border flex items-start gap-3 transition-all animate-in fade-in ${
                lastResult.valid && lastResult.status === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : lastResult.status === 'already_checked_in'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              {lastResult.valid && lastResult.status === 'success' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              ) : lastResult.status === 'already_checked_in' ? (
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              )}

              <div className="flex-1 min-w-0 text-left">
                <p className="font-bold text-sm leading-tight">{lastResult.message}</p>
                {lastResult.attendee && (
                  <div className="mt-2 text-xs space-y-1 bg-white/70 rounded-lg p-2.5 border border-black/5">
                    <p>
                      <strong>Attendee:</strong> {lastResult.attendee.attendeeName}
                    </p>
                    <p>
                      <strong>Ticket Code:</strong> <span className="font-mono">{lastResult.attendee.ticketCode}</span>
                    </p>
                    <p>
                      <strong>Event:</strong> {lastResult.attendee.eventTitle}
                    </p>
                    {lastResult.checkedInAt && (
                      <p className="text-[11px] text-slate-500">
                        <strong>Check-in Time:</strong> {new Date(lastResult.checkedInAt).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Scans In This Session */}
          {recentScans.length > 0 && (
            <div className="w-full mt-4 text-left border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Recent Check-Ins ({recentScans.length}):
              </p>
              <div className="space-y-1.5">
                {recentScans.map((scan, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-50 px-3 py-1.5 rounded-lg text-xs">
                    <span className="font-medium text-slate-800">{scan.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">{scan.time}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-sm font-semibold">
                        {scan.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
