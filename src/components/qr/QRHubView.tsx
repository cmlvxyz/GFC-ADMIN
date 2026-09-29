import React, { useState, useEffect } from 'react';
import { 
  QrCode, Camera, ShieldCheck, Printer, Download, Sparkles, CheckCircle2, 
  Calendar, Image as ImageIcon, Users, ExternalLink, RefreshCw 
} from 'lucide-react';
import { GFCEvent, Photo, Attendee } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { QRScannerModal } from './QRScannerModal.tsx';
import { QRDisplayModal } from './QRDisplayModal.tsx';
import { useToast } from '../common/Toast.tsx';

export const QRHubView: React.FC = () => {
  const { showToast } = useToast();
  const [events, setEvents] = useState<GFCEvent[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [activeModalQR, setActiveModalQR] = useState<{
    title: string;
    subtitle: string;
    qrValue: string;
    entityType: 'event' | 'photo' | 'ticket';
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsData, photosData, attendeesData] = await Promise.all([
        api.getEvents({ status: 'published' }),
        api.getPhotos(),
        api.getEventAttendees('evt-101').catch(() => []),
      ]);
      setEvents(eventsData);
      setPhotos(photosData);
      setAttendees(attendeesData);
      if (eventsData.length > 0 && !selectedEventId) {
        setSelectedEventId(eventsData[0].id);
      }
    } catch (err: any) {
      showToast('error', 'Error loading QR Hub data', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalEventQRs = events.length;
  const totalPhotoQRs = photos.length;
  const totalAttendeeTickets = attendees.length;
  const totalCheckIns = attendees.filter((a) => a.status === 'checked_in').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-sm border border-indigo-900/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Preserved GFC QR Architecture
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">QR Code Center & Attendance Hub</h1>
          <p className="text-xs text-indigo-200/80 mt-1 max-w-xl leading-relaxed">
            Centralized terminal to monitor, generate, and scan QR Codes for church entrance verification, individual attendee passes, and photo gallery sharing.
          </p>
        </div>

        <button
          onClick={() => setIsScannerOpen(true)}
          className="flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all hover:scale-102 cursor-pointer shrink-0"
        >
          <Camera className="w-5 h-5" />
          Launch Door Check-In Scanner
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-500">Event QR Codes</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalEventQRs}</p>
          <p className="text-[11px] text-indigo-600 mt-1">Generated & active</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
            <ImageIcon className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-500">Photo Share QRs</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalPhotoQRs}</p>
          <p className="text-[11px] text-purple-600 mt-1">Preserved in All Photos</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-500">Door Check-Ins</p>
          <p className="text-2xl font-bold text-emerald-600 mt-0.5">{totalCheckIns}</p>
          <p className="text-[11px] text-slate-400 mt-1">Scanned & validated</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-500">Attendee Passes</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalAttendeeTickets}</p>
          <p className="text-[11px] text-amber-600 mt-1">With unique ticket QR</p>
        </div>
      </div>

      {/* Grid: Events QR List and Photos QR List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Events QR Module */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Events QR Codes</h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">{events.length} Events</span>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Every published GFC church service or special event has an encoded check-in QR code with cryptographic verification token.
            </p>

            <div className="space-y-3">
              {events.slice(0, 4).map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-xs font-bold text-slate-900 truncate">{evt.title}</p>
                    <p className="text-[11px] text-slate-500">{evt.date} • {evt.time}</p>
                  </div>
                  <button
                    onClick={() =>
                      setActiveModalQR({
                        title: evt.title,
                        subtitle: `${evt.date} • ${evt.location}`,
                        qrValue: evt.qrCodeValue,
                        entityType: 'event',
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    Display QR
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Photos QR Module */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">All Photos QR Codes</h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">{photos.length} Photos</span>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Preserved QR sharing enables attendees to scan and open high-resolution gallery memories on their mobile devices immediately.
            </p>

            <div className="space-y-3">
              {photos.slice(0, 4).map((pho) => (
                <div
                  key={pho.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-3">
                    <img
                      src={pho.imageUrl}
                      alt={pho.title}
                      className="w-9 h-9 object-cover rounded-lg border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{pho.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">{pho.albumName}</p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setActiveModalQR({
                        title: pho.title,
                        subtitle: `Album: ${pho.albumName}`,
                        qrValue: pho.qrCodeValue,
                        entityType: 'photo',
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    Photo QR
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        targetEventId={selectedEventId}
        onCheckInSuccess={loadData}
      />

      {/* QR Display Modal */}
      {activeModalQR && (
        <QRDisplayModal
          isOpen={!!activeModalQR}
          onClose={() => setActiveModalQR(null)}
          title={activeModalQR.title}
          subtitle={activeModalQR.subtitle}
          qrValue={activeModalQR.qrValue}
          entityType={activeModalQR.entityType}
        />
      )}
    </div>
  );
};
