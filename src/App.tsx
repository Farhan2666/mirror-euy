import React, { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { ConnectPage } from './pages/ConnectPage';
import { MirrorPage } from './pages/MirrorPage';

export interface MirrorSession {
  deviceName: string;
  wsUrl: string;
  isDemo: boolean;
  connectionType: 'USB' | 'WiFi';
}

export const App: React.FC = () => {
  const [session, setSession] = useState<MirrorSession | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isStreamMode, setIsStreamMode] = useState(false);
  const api = (window as any).electronAPI;

  const toggleFullScreen = async (next?: boolean) => {
    const target = typeof next === 'boolean' ? next : !isFullScreen;
    setIsFullScreen(target);
    if (api?.setFullScreen) {
      await api.setFullScreen(target);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isStreamMode) {
          setIsStreamMode(false);
        } else if (isFullScreen) {
          toggleFullScreen(false);
        }
      } else if (e.key === 'F11' && session) {
        e.preventDefault();
        if (isStreamMode) setIsStreamMode(false);
        toggleFullScreen();
      } else if (e.key === 'F10' && session) {
        e.preventDefault();
        if (isFullScreen) toggleFullScreen(false);
        setIsStreamMode(s => !s);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullScreen, isStreamMode, session]);

  const hideChrome = isFullScreen || isStreamMode;

  return (
    <div className={`flex flex-col h-screen select-none ${hideChrome ? 'bg-black' : 'bg-white'}`}>
      {/* ── Title Bar (hidden in fullscreen or OBS/TT stream mode) ── */}
      {!hideChrome && (
        <div className="app-drag flex items-center justify-between h-10 px-4 border-b border-slate-100 bg-white shrink-0">
          <div className="app-no-drag flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-brand flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <rect x="1" y="1" width="4" height="4" rx="1" fill="white"/>
                <rect x="6" y="1" width="4" height="4" rx="1" fill="white" opacity="0.6"/>
                <rect x="1" y="6" width="4" height="4" rx="1" fill="white" opacity="0.6"/>
                <rect x="6" y="6" width="4" height="4" rx="1" fill="white" opacity="0.4"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Mirror Euy</span>
          </div>

          <div className="app-no-drag flex items-center">
            <button
              onClick={() => api?.minimize()}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => api?.maximize()}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={() => api?.close()}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-hidden">
        {!session ? (
          <ConnectPage onConnect={setSession} />
        ) : (
          <MirrorPage
            session={session}
            isFullScreen={isFullScreen}
            isStreamMode={isStreamMode}
            onSetStreamMode={setIsStreamMode}
            onToggleFullScreen={() => toggleFullScreen()}
            onDisconnect={() => {
              if (isStreamMode) setIsStreamMode(false);
              if (isFullScreen) toggleFullScreen(false);
              setSession(null);
            }}
          />
        )}
      </div>
    </div>
  );
};
