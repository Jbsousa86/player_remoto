import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PairingScreen from './components/PairingScreen';
import PlayerScreen from './components/PlayerScreen';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import ErrorBoundary from './components/ErrorBoundary'; // Import ErrorBoundary
import { syncService } from './lib/syncService';
import { Maximize, WifiOff } from 'lucide-react';

function PlayerContainer() {
  const [isPaired, setIsPaired] = useState(false);
  const [screenId, setScreenId] = useState('');
  const [playlist, setPlaylist] = useState([]);
  const [orientation, setOrientation] = useState('landscape');
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Global error handler for debugging on TVs
    const handleGlobalError = (event) => {
      console.error('Global Error:', event.error);
      // You could even alert(event.message) here if needed for extreme debugging
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('error', handleGlobalError);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('error', handleGlobalError);
    };
  }, []);

  // Interaction Lock
  useEffect(() => {
    if (isPaired) {
      const lockKeys = (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) e.preventDefault();
        if (e.key === 'F12' || e.key === 'ContextMenu') e.preventDefault();
      };
      const blockContext = (e) => e.preventDefault();
      window.addEventListener('keydown', lockKeys);
      window.addEventListener('contextmenu', blockContext);
      return () => {
        window.removeEventListener('keydown', lockKeys);
        window.removeEventListener('contextmenu', blockContext);
      };
    }
  }, [isPaired]);

  // Handle Pairing & Screen ID
  useEffect(() => {
    try {
      const savedScreenId = localStorage.getItem('totem_screen_id');
      if (savedScreenId) {
        setScreenId(savedScreenId);
        setIsPaired(true);
      }
    } catch (e) {
      console.warn('Storage not available');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleManualPair = (id) => {
    try {
      localStorage.setItem('totem_screen_id', id);
    } catch (e) { }
    setScreenId(id);
    setIsPaired(true);
  };

  // Realtime Sync from Firebase (Playlist & Commands)
  useEffect(() => {
    if (!isPaired || !screenId) return;

    console.log(`Connecting to Screen: ${screenId}`);

    const unsubscribe = syncService.subscribeToScreen(screenId, (data) => {
      if (!data) return;

      // 1. Update Playlist
      if (data.playlist) {
        setPlaylist(data.playlist);
      }

      // 2. Update Orientation
      if (data.orientation) {
        setOrientation(data.orientation);
      }

      // 3. Check for Remote Commands (RELOAD)
      if (data.command?.type === 'RELOAD') {
        const cmdTime = data.command.timestamp;
        const lastReload = parseInt(localStorage.getItem('last_reload_time') || '0');

        if (cmdTime > lastReload) {
          localStorage.setItem('last_reload_time', cmdTime.toString());
          console.log('🔄 Remote RELOAD command received via direct listener!');
          window.location.reload();
        }
      }
    });

    return () => unsubscribe();
  }, [isPaired, screenId]);

  // Heartbeat Mechanism
  useEffect(() => {
    if (!isPaired || !screenId || !isOnline) return;

    // Initial heartbeat
    syncService.updateHeartbeat(screenId);

    const interval = setInterval(() => {
      syncService.updateHeartbeat(screenId);
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, [isPaired, screenId, isOnline]);

  // Screen Wake Lock (Prevent Sleep - with TV safety)
  useEffect(() => {
    if (!isPaired || !('wakeLock' in navigator)) return;

    let wakeLock = null;

    const requestWakeLock = async () => {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn(`Fail to acquire wake lock: ${err.message}`);
      }
    };

    requestWakeLock();

    // Re-request when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLock) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().then(() => {
          wakeLock = null;
          console.log('💤 Wake Lock released');
        });
      }
    };
  }, [isPaired]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn(`Error: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  if (loading) {
    return <div style={{ color: 'white' }}>Loading...</div>;
  }

  // SIMPLIFIED CONTAINER - NO ICONS, NO ABSOLUTE BG
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#222' }}>
      <p style={{ position: 'fixed', top: 0, right: 0, color: 'lime', zIndex: 99999, fontSize: '20px', backgroundColor: 'black' }}>
        V: DEBUG-FINAL
      </p>

      {!isPaired ? (
        <PairingScreen onPair={handleManualPair} />
      ) : (
        <ErrorBoundary>
          <PlayerScreen playlist={playlist} orientation={orientation} />
        </ErrorBoundary>
      )}
    </div>
  );
}

function AdminRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('admin_auth') === 'true');
  if (!isAuthenticated) return <AdminLogin onLogin={setIsAuthenticated} />;
  return children;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PlayerContainer />} />
          <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/pair" element={<AdminRoute><AdminPanel isPairing={true} /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
