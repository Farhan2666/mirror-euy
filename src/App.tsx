import React, { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { ConnectPage } from './pages/ConnectPage';
import { MirrorPage } from './pages/MirrorPage';
import logoImg from './assets/logo.png';

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
    <div className={`flex flex-col h-screen select-none ${hideChrome ? 'bg-black' : 'bg-brand-navy'}`}>
      {/* ── Title Bar (hidden in fullscreen or OBS/TT stream mode) ── */}
      {!hideChrome && (
        <div className="app-drag flex items-center justify-between h-10 px-3 border-b border-brand-navy-border bg-brand-navy shrink-0">
          <div className="app-no-drag flex items-center gap-2">
            <img src={logoImg} alt="Mirror Euy" className="w-6 h-6 rounded object-cover" />
            <span className="text-sm font-bold tracking-wide" style={{ color: '#2DD4BF' }}>MIRROR EUY</span>
          </div>

          <div className="app-no-drag flex items-center">
            <button
              onClick={() => api?.minimize()}
              className="w-9 h-9 flex items-center justify-center rounded transition-colors"
              style={{ color: '#67E8F9' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#133248')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => api?.maximize()}
              className="w-9 h-9 flex items-center justify-center rounded transition-colors"
              style={{ color: '#67E8F9' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#133248')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={() => api?.close()}
              className="w-9 h-9 flex items-center justify-center rounded transition-colors"
              style={{ color: '#67E8F9' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#67E8F9'; }}
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
