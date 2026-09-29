import React, { useState, useEffect } from 'react';
import { 
  Calendar, Image as ImageIcon, ArrowRight, CheckCircle2, 
  MapPin, Clock, Users, ExternalLink, Sparkles, Download, Bell, 
  Share2, Eye, Heart, BookOpen, Edit3, Wallet, Mail, Phone, ChevronRight
} from 'lucide-react';
import { GFCEvent, Photo, Announcement, WebsiteContent } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { Badge } from '../common/Badge.tsx';
import { useToast } from '../common/Toast.tsx';

interface GFCPublicAppProps {
  onSwitchToAdmin: (targetTab?: string) => void;
}

export const GFCPublicApp: React.FC<GFCPublicAppProps> = ({ onSwitchToAdmin }) => {
  const { showToast } = useToast();
  const [content, setContent] = useState<WebsiteContent | null>(null);
  const [events, setEvents] = useState<GFCEvent[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Registration Modal State (clean RSVP without ticket passes)
  const [registeringEvent, setRegisteringEvent] = useState<GFCEvent | null>(null);
  const [attendeeName, setAttendeeName] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [attendeePhone, setAttendeePhone] = useState('');
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState<string | null>(null);

  // Photo Lightbox
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [photoFilter, setPhotoFilter] = useState<string>('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [websiteData, eventsData, photosData, annData] = await Promise.all([
        api.getWebsiteContent(),
        api.getEvents({ status: 'published' }),
        api.getPhotos(),
        api.getAnnouncements(true),
      ]);
      setContent(websiteData);
      setEvents(eventsData);
      setPhotos(photosData);
      setAnnouncements(annData);
    } catch (err: any) {
      showToast('error', 'Error loading church content', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registeringEvent || !attendeeName.trim() || !attendeeEmail.trim()) return;

    setIsSubmittingReg(true);
    try {
      await api.registerAttendee(
        registeringEvent.id,
        attendeeName.trim(),
        attendeeEmail.trim(),
        attendeePhone.trim()
      );
      setRegistrationSuccess(`Thank you ${attendeeName.trim()}! You are registered for "${registeringEvent.title}". We look forward to worshiping with you.`);
      setRegisteringEvent(null);
      setAttendeeName('');
      setAttendeeEmail('');
      setAttendeePhone('');
      loadData();
    } catch (err: any) {
      showToast('error', 'Registration Failed', err.message);
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const filteredPhotos = photos.filter(
    (p) => photoFilter === 'all' || p.category.toLowerCase().includes(photoFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Admin Switcher & Edit Mode Banner */}
      <div className="bg-slate-900 text-white px-4 py-2 border-b border-slate-800 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-semibold text-slate-200">
              Live Church Website Portal
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onSwitchToAdmin('website-editor')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Website Descriptions &amp; Content</span>
            </button>

            <button
              onClick={() => onSwitchToAdmin('dashboard')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
            >
              <span>GFC Admin</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Top Scripture Verse Bar (Matching User Website) */}
      <div className="bg-indigo-50/80 border-b border-indigo-100/80 py-2.5 px-4 text-center">
        <p className="max-w-5xl mx-auto text-xs sm:text-sm italic text-indigo-950 leading-relaxed">
          {content?.bannerVerse || '“Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.”'}{' '}
          <b className="not-italic font-bold text-indigo-700">{content?.bannerVerseRef || '2 Corinthians 9:7 (NIV)'}</b>
        </p>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img
              src={content?.logoUrl || '/gfc-logo.png'}
              alt="Gospel Fellowship Church"
              className="w-12 h-12 rounded-full border-2 border-indigo-600 shadow-xs object-cover bg-white"
            />
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-tight">
                {content?.churchName || 'Gospel Fellowship Church'}
              </h1>
              <p className="text-xs font-semibold text-indigo-600">
                {content?.subTagline || 'Rooted in Faith, Growing in Fellowship, Reaching in Love'}
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-600">
            <a href="#about" className="hover:text-indigo-600 transition-colors">
              About Us
            </a>
            <a href="#services" className="hover:text-indigo-600 transition-colors">
              Service Times
            </a>
            <a href="#events" className="hover:text-indigo-600 transition-colors">
              Events
            </a>
            <a href="#photos" className="hover:text-indigo-600 transition-colors">
              Photos
            </a>
            <a href="#giving" className="hover:text-indigo-600 transition-colors">
              Tithes &amp; Giving
            </a>
            <a href="#contact" className="hover:text-indigo-600 transition-colors">
              Contact
            </a>
          </nav>
        </div>
      </header>

      {/* Registration Confirmation Alert */}
      {registrationSuccess && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 text-emerald-800 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{registrationSuccess}</span>
            </div>
            <button
              onClick={() => setRegistrationSuccess(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white py-16 sm:py-24 px-4 sm:px-6 border-b border-slate-200">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>{content?.heroBadge || 'Welcome to Our Church Family'}</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            {content?.heroHeadline || 'Worship, Community & Fellowship in Christ'}
          </h2>

          <p className="text-xs sm:text-base text-slate-600 mt-4 max-w-3xl mx-auto leading-relaxed">
            {content?.heroDescription || 'Join Gospel Fellowship Church for inspirational Sunday services, youth gatherings, community outreach, and heartfelt fellowship in Limay, Bataan.'}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="#events"
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition-all hover:scale-102 cursor-pointer"
            >
              {content?.ctaButtonText || 'Browse Church Events'}
            </a>
            <a
              href="#photos"
              className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm border border-slate-200 transition-all cursor-pointer"
            >
              {content?.ctaSecondaryText || 'View Fellowship Photos'}
            </a>
            <a
              href="#giving"
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Wallet className="w-4 h-4" />
              <span>Tithes &amp; Giving</span>
            </a>
          </div>

          {/* Hero Image Showcase */}
          {content?.heroImageUrl && (
            <div className="mt-10 rounded-2xl overflow-hidden border border-slate-200 shadow-md max-h-[420px]">
              <img
                src={content.heroImageUrl}
                alt="Church Fellowship Banner"
                className="w-full h-full object-cover max-h-[420px]"
              />
            </div>
          )}
        </div>
      </section>

      {/* Announcements Bulletin */}
      {announcements.length > 0 && (
        <section id="announcements" className="bg-amber-50/80 border-b border-amber-200 py-3.5 px-4">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wide mr-2">
                Bulletin:
              </span>
              <span className="text-xs font-semibold text-amber-950">
                {announcements[0].title} — {announcements[0].content}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* About Us & Pastor Welcome Section */}
      <section id="about" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: About Text & Mission/Vision */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">
                Who We Are
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {content?.aboutTitle || 'About Gospel Fellowship Church'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-3 leading-relaxed">
                {content?.aboutDescription || 'Gospel Fellowship Church is a Bible-believing, Christ-exalting fellowship in Limay, Bataan. We exist to declare the glorious gospel of Jesus Christ, disciple believers into spiritual maturity, and serve our local community with genuine Christian love and compassion.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700 mb-1">
                  Our Mission
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {content?.mission || 'To preach the Word of God faithfully, cultivate a loving fellowship of believers, and make devoted disciples of Jesus Christ who impact the nation.'}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700 mb-1">
                  Our Vision
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {content?.vision || 'A thriving, Spirit-filled church of passionate worshipers and servant leaders, transforming families and communities across Bataan and beyond.'}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Pastor's Welcome Card */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={content?.pastorImageUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                alt={content?.pastorName || 'Pastor'}
                className="w-16 h-16 rounded-full object-cover border-2 border-indigo-600 shadow-xs"
              />
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  {content?.pastorName || 'Pastor Edrian Clavel'}
                </h3>
                <p className="text-xs text-indigo-600 font-semibold">
                  {content?.pastorRole || 'Senior Pastor'}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <h4 className="font-bold text-xs text-slate-800 mb-1">
                {content?.pastorWelcomeTitle || 'A Message from Pastor'}
              </h4>
              <p className="text-xs text-slate-600 italic leading-relaxed">
                “{content?.pastorWelcomeMessage || 'Welcome to Gospel Fellowship Church! Whether you are seeking spiritual answers, looking for a church family, or desiring deeper discipleship, you are always welcome here.'}”
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Weekly Worship Service Times */}
      <section id="services" className="py-16 px-4 sm:px-6 bg-slate-50/60 border-t border-b border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">
              Join Our Gatherings
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              Worship Service Times
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              You and your family are warmly invited to worship, pray, and grow with us every week.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(content?.serviceTimes || [
              { name: 'Sunday Grand Worship', dayTime: 'Sundays 9:00 AM - 11:30 AM', description: 'Main Worship Sanctuary with Praise & Communion' },
              { name: 'Midweek Prayer & Bible Study', dayTime: 'Wednesdays 7:00 PM - 8:30 PM', description: 'Expository Scripture Teaching & Intercession' },
              { name: 'Youth Alive Fellowship', dayTime: 'Saturdays 4:00 PM - 6:00 PM', description: 'Dynamic Youth Ministry, Mentorship & Fun' }
            ]).map((srv, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base leading-snug">
                    {srv.name}
                  </h3>
                  <p className="text-xs font-bold text-indigo-600 mt-1">
                    {srv.dayTime}
                  </p>
                  <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                    {srv.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tithes & Offering Portal Section */}
      <section id="giving" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="bg-white rounded-2xl border-2 border-indigo-100 p-6 sm:p-10 shadow-xs">
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-emerald-600 tracking-wider uppercase flex items-center gap-1.5">
              <Heart className="w-4 h-4 fill-emerald-600 text-emerald-600" />
              <span>Biblical Stewardship</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              {content?.givingTitle || 'Tithes, Offerings & Stewardship'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              {content?.givingDescription || 'We worship God through faithful stewardship. Your tithes and generous love gifts support our Sunday ministries, church facilities, feeding programs, and missionary outreach.'}
            </p>

            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium">
              <span>{content?.givingVerse || '“Bring the whole tithe into the storehouse, that there may be food in my house.”'}</span>{' '}
              <b className="font-bold">{content?.givingVerseRef || 'Malachi 3:10'}</b>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-100">
            {/* Bank Transfer Details */}
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Bank Deposit / Online Transfer
              </span>
              <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                {content?.bankAccountDetails || 'BDO Unibank - Gospel Fellowship Church\nAccount No: 0072-1082-9912'}
              </pre>
            </div>

            {/* GCash Details */}
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                GCash Mobile Giving
              </span>
              <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                {content?.gcashDetails || 'GCash: 0917-888-1234 (Edrian C.)'}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Events Section */}
      <section id="events" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">
              Schedule &amp; Gatherings
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              Upcoming Church Events
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Sign up to attend and reserve your seats with your family.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">Loading church events...</div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
            No published events currently scheduled. Check back soon!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((evt) => (
              <div
                key={evt.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 bg-slate-100 overflow-hidden">
                    <img
                      src={evt.bannerUrl}
                      alt={evt.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3">
                      <Badge variant="primary">{evt.category}</Badge>
                    </div>
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs text-white text-xs font-medium px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-300" />
                      <span>{evt.date}</span>
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-2">
                      {evt.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                      {evt.description}
                    </p>

                    <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{evt.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{evt.location}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0">
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {evt.registeredCount} / {evt.capacity} registered
                    </span>
                    <button
                      onClick={() => setRegisteringEvent(evt)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      Sign Up &amp; RSVP
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* All Photos Section */}
      <section id="photos" className="py-16 px-4 sm:px-6 bg-slate-50/60 border-t border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">
                Fellowship Moments
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                All Photos &amp; Ministry Gallery
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Cherished moments of worship, fellowship, youth ministries, and outreach.
              </p>
            </div>

            {/* Category filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {['all', 'Sunday Worship', 'Youth', 'Outreach', 'Baptism'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setPhotoFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                    photoFilter === cat
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {cat === 'all' ? 'All Photos' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredPhotos.map((photo) => (
              <div
                key={photo.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group"
              >
                <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                  <img
                    src={photo.imageUrl}
                    alt={photo.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => setSelectedPhoto(photo)}
                      title="Preview"
                      className="p-2.5 rounded-full bg-white text-slate-800 hover:bg-slate-100 shadow-md transition-transform hover:scale-110 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs leading-snug line-clamp-1">
                      {photo.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{photo.albumName}</p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>{photo.takenAt}</span>
                    <button
                      onClick={() => setSelectedPhoto(photo)}
                      className="text-indigo-600 hover:text-indigo-800 font-bold"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full border-t border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-slate-200 bg-white">
            <MapPin className="w-6 h-6 text-indigo-600 mb-2" />
            <h4 className="font-bold text-slate-900 text-sm">Church Sanctuary</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {content?.contactAddress || 'GFC Worship Center, Limay, Bataan, Philippines'}
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200 bg-white">
            <Phone className="w-6 h-6 text-indigo-600 mb-2" />
            <h4 className="font-bold text-slate-900 text-sm">Call &amp; SMS</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {content?.contactPhone || '+63 917 123 4567'}
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200 bg-white">
            <Mail className="w-6 h-6 text-indigo-600 mb-2" />
            <h4 className="font-bold text-slate-900 text-sm">Email Fellowship</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {content?.contactEmail || 'contact@gfc-fellowship.org'}
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white text-slate-600 py-10 px-4 sm:px-6 border-t border-slate-200 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={content?.logoUrl || '/gfc-logo.png'} alt="GFC" className="w-8 h-8 rounded-full border border-indigo-600" />
            <div>
              <p className="font-bold text-slate-900 text-sm">{content?.churchName || 'Gospel Fellowship Church (GFC)'}</p>
              <p className="text-[11px] text-slate-500">Rooted in Faith, Growing in Fellowship, Reaching in Love</p>
            </div>
          </div>
          <button
            onClick={() => onSwitchToAdmin('dashboard')}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-colors cursor-pointer"
          >
            Access GFC Admin Portal
          </button>
        </div>
      </footer>

      {/* Registration Modal (Clean RSVP, NO Scanner / Passes) */}
      {registeringEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Event Sign Up &amp; RSVP</h3>
                <p className="text-xs text-slate-500 truncate max-w-[280px]">
                  {registeringEvent.title}
                </p>
              </div>
              <button
                onClick={() => setRegisteringEvent(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegister} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Your Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maria Santos"
                  value={attendeeName}
                  onChange={(e) => setAttendeeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. maria@example.com"
                  value={attendeeEmail}
                  onChange={(e) => setAttendeeEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  placeholder="+63 9..."
                  value={attendeePhone}
                  onChange={(e) => setAttendeePhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-indigo-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingReg}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingReg ? 'Submitting Registration...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl">
            <div className="relative aspect-16/10 bg-black">
              <img
                src={selectedPhoto.imageUrl}
                alt={selectedPhoto.title}
                className="w-full h-full object-contain"
              />
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-3 right-3 bg-black/60 text-white rounded-full p-1.5 hover:bg-black cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{selectedPhoto.title}</h3>
                <p className="text-xs text-slate-500">{selectedPhoto.albumName} • {selectedPhoto.takenAt}</p>
              </div>
              <a
                href={selectedPhoto.imageUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
              >
                Download Photo
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
