import React, { useEffect, useState } from 'react';
import { X, Download, Copy, Check, ExternalLink, Printer, QrCode } from 'lucide-react';
import { generateQRCodeDataURL, generateQRCodeSVG, downloadQRCode } from '../../utils/qr.ts';

interface QRDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  qrValue: string;
  shareUrl?: string;
  entityType: 'event' | 'photo' | 'album' | 'ticket';
  metadata?: {
    label: string;
    value: string;
  }[];
}

export const QRDisplayModal: React.FC<QRDisplayModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  qrValue,
  shareUrl,
  entityType,
  metadata = [],
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || !qrValue) return;

    let mounted = true;
    setLoading(true);

    generateQRCodeDataURL(qrValue, { width: 360, margin: 2 })
      .then((url) => {
        if (mounted) {
          setDataUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate modal QR code:', err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, qrValue]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(qrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadPNG = () => {
    if (!dataUrl) return;
    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
    downloadQRCode(dataUrl, `gfc-${entityType}-${safeTitle}-qr.png`);
  };

  const handleDownloadSVG = async () => {
    try {
      const svgString = await generateQRCodeSVG(qrValue);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
      downloadQRCode(url, `gfc-${entityType}-${safeTitle}-qr.svg`);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error downloading SVG:', e);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - GFC QR Code</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 40px; color: #1e1b4b; }
            .card { max-width: 480px; margin: 0 auto; border: 2px solid #e2e8f0; border-radius: 16px; padding: 32px; }
            .logo { width: 64px; height: 64px; margin-bottom: 12px; }
            h1 { font-size: 20px; margin-bottom: 6px; }
            p { font-size: 14px; color: #475569; margin: 4px 0; }
            .qr-img { width: 280px; height: 280px; margin: 24px auto; display: block; }
            .meta { background: #f8fafc; border-radius: 8px; padding: 12px; text-align: left; font-size: 13px; margin-top: 20px; }
            .meta-row { display: flex; justify-content: space-between; padding: 4px 0; }
            .badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 999px; font-weight: 600; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="card">
            <img class="logo" src="/gfc-logo.png" alt="GFC Logo" />
            <div class="badge">GOSPEL FELLOWSHIP CHURCH (GFC)</div>
            <h1>${title}</h1>
            ${subtitle ? `<p>${subtitle}</p>` : ''}
            <img class="qr-img" src="${dataUrl}" alt="QR Code" />
            <p><strong>Scan with any phone camera or GFC Admin scanner</strong></p>
            <div class="meta">
              ${metadata.map(m => `<div class="meta-row"><strong>${m.label}:</strong> <span>${m.value}</span></div>`).join('')}
              <div class="meta-row"><strong>QR Payload:</strong> <span style="font-family: monospace; font-size: 11px;">${qrValue}</span></div>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/80 flex items-center justify-center text-white">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm capitalize">{entityType} QR Code</h3>
              <p className="text-xs text-slate-300">Preserved GFC QR Code System</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center text-center">
          <h4 className="text-lg font-bold text-slate-900 leading-tight">{title}</h4>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}

          {/* QR Code Container */}
          <div className="relative mt-5 p-4 bg-white rounded-2xl border-2 border-indigo-100 shadow-sm flex items-center justify-center min-w-[260px] min-h-[260px]">
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs">Generating QR Code...</span>
              </div>
            ) : dataUrl ? (
              <div className="relative">
                <img
                  src={dataUrl}
                  alt={`QR Code for ${title}`}
                  className="w-56 h-56 object-contain rounded-lg"
                />
                {/* Authentic GFC center watermark badge */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-white shadow-md p-1 border border-indigo-200 flex items-center justify-center">
                    <img src="/gfc-logo.png" alt="GFC" className="w-full h-full object-contain rounded-full" />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-rose-500">Failed to render QR Code</p>
            )}
          </div>

          {/* Metadata chips */}
          {metadata.length > 0 && (
            <div className="w-full mt-4 bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-left text-xs space-y-1.5">
              {metadata.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-slate-600">
                  <span className="font-medium text-slate-500">{item.label}</span>
                  <span className="font-semibold text-slate-800 text-right truncate max-w-[200px]">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Raw QR Payload box */}
          <div className="w-full mt-3 flex items-center gap-2 bg-slate-100/90 rounded-lg p-2 text-xs border border-slate-200">
            <span className="text-slate-400 font-mono text-[10px] shrink-0 uppercase tracking-wider">Payload:</span>
            <span className="font-mono text-slate-700 truncate flex-1 text-left text-[11px]">{qrValue}</span>
            <button
              onClick={handleCopyCode}
              title="Copy QR Payload"
              className="text-slate-500 hover:text-indigo-600 shrink-0 p-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Share URL if provided */}
          {shareUrl && (
            <div className="w-full mt-2 flex items-center gap-2 bg-indigo-50/70 rounded-lg p-2 text-xs border border-indigo-100">
              <ExternalLink className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-indigo-900 truncate flex-1 text-left text-[11px] font-medium">{shareUrl}</span>
              <button
                onClick={handleCopyLink}
                title="Copy Link"
                className="text-indigo-600 hover:text-indigo-800 shrink-0 font-medium text-[11px]"
              >
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2 w-full mt-5">
            <button
              onClick={handleDownloadPNG}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              PNG
            </button>
            <button
              onClick={handleDownloadSVG}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors border border-slate-200 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              SVG
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors border border-slate-200 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
