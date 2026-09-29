import QRCode from 'qrcode';
import jsQR from 'jsqr';

/**
 * Generates a high-quality QR Code as a data URL (PNG)
 */
export async function generateQRCodeDataURL(
  text: string,
  options?: {
    width?: number;
    margin?: number;
    color?: { dark: string; light: string };
  }
): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: options?.width || 320,
      margin: options?.margin || 2,
      color: options?.color || {
        dark: '#1e1b4b', // GFC Indigo-950
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
  } catch (err) {
    console.error('Failed to generate QR Code:', err);
    throw err;
  }
}

/**
 * Generates an SVG string representation of a QR Code
 */
export async function generateQRCodeSVG(text: string): Promise<string> {
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      margin: 2,
      color: {
        dark: '#1e1b4b',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR Code SVG:', err);
    throw err;
  }
}

/**
 * Triggers a browser download for a QR Code image
 */
export function downloadQRCode(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Decodes a QR code from HTML Image or Canvas using jsQR
 */
export function scanImageData(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });

  return code ? code.data : null;
}

/**
 * Plays a pleasant auditory chime on valid check-in or error tone
 */
export function playChime(type: 'success' | 'warning' | 'error') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === 'success') {
      // High harmonious chime: C6 -> G6
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1046.5, now); // C6
      osc1.frequency.exponentialRampToValueAtTime(1567.98, now + 0.15); // G6

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(523.25, now); // C5
      osc2.frequency.exponentialRampToValueAtTime(783.99, now + 0.15);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } else if (type === 'warning') {
      // Double beep for warning / already checked in
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(440, now + 0.1);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.setValueAtTime(0, now + 0.08);
      gain.gain.setValueAtTime(0.2, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } else {
      // Low buzzer tone for invalid code
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now); // A3
      osc.frequency.linearRampToValueAtTime(160, now + 0.3);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {
    // Audio context may be restricted by autoplay policy
    console.debug('Audio chime skipped:', e);
  }
}
