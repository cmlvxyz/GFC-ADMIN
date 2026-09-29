import React, { useState, useEffect } from 'react';
import { 
  Camera, Upload, CheckCircle2, Image as ImageIcon, X, ArrowLeft, 
  ExternalLink, Sparkles, ShieldCheck, Heart 
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { useToast } from '../common/Toast.tsx';

interface GFCPublicUploadViewProps {
  onBackToApp?: () => void;
}

export const GFCPublicUploadView: React.FC<GFCPublicUploadViewProps> = ({ onBackToApp }) => {
  const { showToast } = useToast();
  const [eventParam, setEventParam] = useState<string>('');
  const [dateParam, setDateParam] = useState<string>('');
  const [eventId, setEventId] = useState<string | null>(null);
  const [uploaderName, setUploaderName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadedCount, setUploadedCount] = useState<number>(0);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const evt = params.get('event') || '';
      const dt = params.get('date') || '';
      setEventParam(evt ? evt.toUpperCase() : 'GFC GATHERING');
      setDateParam(dt || 'General Church Collection');
    }
  }, []);

  // Link the upload to a real event so the photos also appear on the church
  // website (the public site groups photos per event via eventId).
  useEffect(() => {
    let cancelled = false;
    api.getEvents().then(events => {
      if (cancelled) return;
      const needle = eventParam.toLowerCase();
      const match = events.find(e => e.title.toLowerCase() === needle)
        || events.find(e => e.title.toLowerCase().includes(needle))
        || events.find(e => needle.includes(e.title.toLowerCase()));
      if (match) setEventId(match.id);
    }).catch(() => { /* uploads still work, just not grouped by event */ });
    return () => { cancelled = true; };
  }, [eventParam]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedFiles((prev) => [
            ...prev,
            { name: file.name, url: event.target!.result as string },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      showToast('warning', 'No Photos', 'Please select at least one photo to upload.');
      return;
    }

    setIsUploading(true);
    try {
      for (const file of selectedFiles) {
        await api.createPhoto({
          title: `${eventParam} - ${file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')}`,
          imageUrl: file.url,
          albumName: `${eventParam} (${dateParam})`,
          albumDate: dateParam,
          eventId: eventId,
          category: eventParam.includes('YOUTH') ? 'Youth Ministry' : 'Sunday Worship',
          uploaderName: uploaderName.trim() || 'Church Member',
          takenAt: new Date().toISOString().split('T')[0],
          isFeatured: true,
        });
      }

      setUploadedCount(selectedFiles.length);
      setUploadSuccess(true);
      setSelectedFiles([]);
      showToast('success', 'Upload Successful', `Uploaded ${selectedFiles.length} photos to GFC Media!`);
    } catch (err: any) {
      showToast('error', 'Upload Failed', err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans">
      {/* Top Header */}
      <header className="bg-slate-950/90 border-b border-slate-800 px-4 sm:px-6 py-4 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/gfc-logo.png"
              alt="GFC Logo"
              className="w-9 h-9 rounded-full border border-indigo-400 bg-white object-cover"
            />
            <div>
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-2">
                Gospel Fellowship Church
              </h1>
              <p className="text-[11px] text-indigo-400">Media Upload Portal</p>
            </div>
          </div>

          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to GFC</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
        {uploadSuccess ? (
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 text-center space-y-5 animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Photos Uploaded Successfully!</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Thank you for contributing <span className="font-bold text-white">{uploadedCount} photos</span> to{' '}
                <span className="text-indigo-400 font-semibold">{eventParam}</span>. They are now synchronized with the church database.
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setUploadSuccess(false)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Upload More Photos
              </button>
              {onBackToApp && (
                <button
                  onClick={onBackToApp}
                  className="px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Go to GFC Admin
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-slate-950 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            {/* Event Context Pill */}
            <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 block mb-0.5">
                  Uploading To Event
                </span>
                <p className="font-bold text-sm sm:text-base text-white">{eventParam}</p>
                <p className="text-xs text-indigo-300 mt-0.5">{dateParam}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 shrink-0">
                QR Verified
              </span>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-5">
              {/* Uploader Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Your Name / Ministry (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Media Team / Bro. Joshua"
                  value={uploaderName}
                  onChange={(e) => setUploaderName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Photo Upload Zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select Photos *
                </label>
                <label className="border-2 border-dashed border-slate-800 hover:border-indigo-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition-all text-center">
                  <div className="w-12 h-12 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Tap to take photo or choose from gallery</p>
                    <p className="text-[11px] text-slate-400 mt-1">Supports JPG, PNG, WEBP</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Photos Preview */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      Selected ({selectedFiles.length} photos)
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedFiles([])}
                      className="text-rose-400 hover:text-rose-300 text-[11px]"
                    >
                      Remove all
                    </button>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="relative rounded-xl overflow-hidden aspect-square border border-slate-800 bg-slate-900 group"
                      >
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/75 text-white hover:bg-rose-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isUploading || selectedFiles.length === 0}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>
                  {isUploading ? 'Uploading to GFC System...' : `Upload ${selectedFiles.length} Photo${selectedFiles.length === 1 ? '' : 's'}`}
                </span>
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-slate-500 text-[11px] border-t border-slate-950">
        <p>Gospel Fellowship Church • Shared Media System</p>
      </footer>
    </div>
  );
};
