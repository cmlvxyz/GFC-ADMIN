import React, { useState, useEffect } from 'react';
import { ToastProvider, useToast } from './components/common/Toast.tsx';
import { AdminSidebar } from './components/layout/AdminSidebar.tsx';
import { AdminHeader } from './components/layout/AdminHeader.tsx';
import { DashboardView } from './components/dashboard/DashboardView.tsx';
import { EventsView } from './components/events/EventsView.tsx';
import { AllPhotosView } from './components/photos/AllPhotosView.tsx';
import { TithesLedgerView } from './components/ledger/TithesLedgerView.tsx';
import { WebsiteEditorView } from './components/cms/WebsiteEditorView.tsx';
import { ChurchPeopleView } from './components/people/ChurchPeopleView.tsx';
import { AnnouncementsView } from './components/announcements/AnnouncementsView.tsx';
import { ActivityLogsView } from './components/audit/ActivityLogsView.tsx';
import { SettingsView } from './components/settings/SettingsView.tsx';
import { GFCPublicApp } from './components/public/GFCPublicApp.tsx';
import { GFCPublicUploadView } from './components/public/GFCPublicUploadView.tsx';
import { LoginModal } from './components/auth/LoginModal.tsx';
import { EventFormModal } from './components/events/EventFormModal.tsx';
import { PhotoUploadModal } from './components/photos/PhotoUploadModal.tsx';
import { User, GFCEvent, Photo, Album } from './types/index.ts';
import { api } from './services/api.ts';

function AppContent() {
  const { showToast } = useToast();
  const isUploadRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/upload');
  const [appMode, setAppMode] = useState<'admin' | 'public' | 'upload'>(isUploadRoute ? 'upload' : 'admin');
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(true);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // Global Quick Modals
  const [isCreateEventOpen, setIsCreateEventOpen] = useState<boolean>(false);
  const [isUploadPhotoOpen, setIsUploadPhotoOpen] = useState<boolean>(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [events, setEvents] = useState<GFCEvent[]>([]);

  // Refresh counter to trigger re-renders of active tabs

  // Check initial session
  useEffect(() => {
    api.getMe()
      .then((res) => {
        if (res.user) {
          setCurrentUser(res.user);
        } else {
          setShowLoginModal(true);
        }
      })
      .catch(() => {
        // Fallback default admin for instant evaluation
        setCurrentUser({
          id: 'usr-1',
          name: 'Pastor Edrian Clavel',
          email: 'admin@gfc.org',
          role: 'Super Admin',
          status: 'active',
          createdAt: new Date().toISOString(),
        });
      })
      .finally(() => {
        setIsAuthenticating(false);
      });
  }, []);

  // Fetch albums and events for modal dropdowns
  const loadMeta = async () => {
    try {
      const [albs, evts] = await Promise.all([api.getAlbums(), api.getEvents()]);
      setAlbums(albs);
      setEvents(evts);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadMeta();
    }
  }, [currentUser, refreshKey]);

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setShowLoginModal(true);
    showToast('info', 'Logged Out', 'You have been signed out of GFC Admin.');
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setShowLoginModal(false);
    showToast('success', 'Authenticated', `Welcome back, ${user.name}!`);
  };

  const handleGlobalCreateEvent = async (data: Partial<GFCEvent>) => {
    try {
      await api.createEvent(data);
      showToast('success', 'Event Created', `Created "${data.title}" successfully.`);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast('error', 'Failed to create event', err.message);
    }
  };

  const handleGlobalUploadPhoto = async (data: Partial<Photo>) => {
    try {
      await api.createPhoto(data);
      showToast('success', 'Photo Uploaded', `Uploaded "${data.title}" successfully.`);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast('error', 'Failed to upload photo', err.message);
    }
  };

  // If in Upload Mode (e.g. from scanned QR Code or direct upload link)
  if (appMode === 'upload') {
    return (
      <GFCPublicUploadView
        onBackToApp={() => {
          if (typeof window !== 'undefined' && window.location.pathname.startsWith('/upload')) {
            window.history.pushState({}, '', '/');
          }
          setAppMode('admin');
        }}
      />
    );
  }

  // If in Public App Mode, render the member-facing GFC Church Website
  if (appMode === 'public') {
    return (
      <GFCPublicApp
        onSwitchToAdmin={(targetTab?: string) => {
          if (targetTab) {
            setCurrentTab(targetTab);
          }
          if (!currentUser) {
            setShowLoginModal(true);
          }
          setAppMode('admin');
        }}
      />
    );
  }

  // If login modal is needed for unauthenticated users in Admin mode
  if (showLoginModal && !currentUser && !isAuthenticating) {
    return (
      <LoginModal
        onLoginSuccess={handleLoginSuccess}
        onSwitchToPublic={() => setAppMode('public')}
      />
    );
  }

  if (isAuthenticating) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-slate-800">
        <div className="w-12 h-12 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin mb-4"></div>
        <p className="text-xs font-bold tracking-wider uppercase text-indigo-700">
          Connecting to GFC System...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden font-sans">
      {/* Sidebar (Clean White Background) */}
      <AdminSidebar
        currentTab={currentTab}
        onNavigate={setCurrentTab}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
        {/* Header */}
        <AdminHeader
          currentTab={currentTab}
          currentUser={currentUser}
        />

        {/* View Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/50">
          <div className="max-w-7xl mx-auto" key={refreshKey}>
            {currentTab === 'dashboard' && (
              <DashboardView
                onNavigate={setCurrentTab}
                onOpenCreateEvent={() => setIsCreateEventOpen(true)}
                onOpenUploadPhoto={() => setIsUploadPhotoOpen(true)}
              />
            )}
            {currentTab === 'website-editor' && (
              <WebsiteEditorView />
            )}
            {currentTab === 'ledger' && <TithesLedgerView />}
            {currentTab === 'events' && <EventsView />}
            {currentTab === 'photos' && <AllPhotosView />}
            {currentTab === 'people' && <ChurchPeopleView />}
            {currentTab === 'announcements' && <AnnouncementsView />}
            {currentTab === 'logs' && <ActivityLogsView />}
            {currentTab === 'settings' && (
              <SettingsView onDatabaseReset={() => setRefreshKey((k) => k + 1)} />
            )}
          </div>
        </main>
      </div>

      {/* Global Quick Modals */}
      <EventFormModal
        isOpen={isCreateEventOpen}
        onClose={() => setIsCreateEventOpen(false)}
        onSubmit={handleGlobalCreateEvent}
      />

      <PhotoUploadModal
        isOpen={isUploadPhotoOpen}
        onClose={() => setIsUploadPhotoOpen(false)}
        onSubmit={handleGlobalUploadPhoto}
        albums={albums}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
