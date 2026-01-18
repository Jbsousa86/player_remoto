import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PairingScreen from './components/PairingScreen';
import PlayerScreen from './components/PlayerScreen';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
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
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black overflow-hidden p-0 m-0">
      <div className="absolute top-0 left-0 right-0 p-4 z-50 flex justify-between items-center transition-opacity duration-500 opacity-0 group-hover:opacity-100">
        <div className="flex gap-2 text-white">
          {!isOnline && (
            <div className="bg-red-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
              <WifiOff className="w-3 h-3" /> Offline
            </div>
          )}
          <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-white/50 uppercase border border-white/5">
            SCREEN ID: {screenId}
          </div>
        </div>
        <button
          onClick={toggleFullscreen}
          className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all border border-white/10"
        >
          <Maximize className="w-5 h-5" />
        </button>
      </div>

      {!isPaired ? (
        <PairingScreen onPair={handleManualPair} />
      ) : (
        <PlayerScreen playlist={playlist} orientation={orientation} />
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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlayerContainer />} />
        <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        <Route path="/admin/pair" element={<AdminRoute><AdminPanel isPairing={true} /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
