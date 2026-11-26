import React, { useState } from 'react';
import { 
  Minus, 
  Square, 
  X, 
  Pin, 
  Activity, 
  Cpu, 
  Zap, 
  Wifi, 
  Usb, 
  ShieldCheck,
  Radio
} from 'lucide-react';
import { ConnectionType, TelemetryMetrics } from '../types';

interface HeaderBarProps {
  telemetry: TelemetryMetrics | null;
  isConnected: boolean;
  deviceName?: string;
  onOpenSettings: () => void;
  onOpenCollab: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  telemetry,
  isConnected,
  deviceName,
  onOpenSettings,
  onOpenCollab
}) => {
  const [isPinned, setIsPinned] = useState(false);

  const handleMinimize = () => {
    if ((window as any).electronAPI?.minimize) {
      (window as any).electronAPI.minimize();
    }
  };

  const handleMaximize = () => {
    if ((window as any).electronAPI?.maximize) {
      (window as any).electronAPI.maximize();
    }
  };

  const handleClose = () => {
    if ((window as any).electronAPI?.close) {
      (window as any).electronAPI.close();
    }
  };

  const togglePin = async () => {
    const next = !isPinned;
    setIsPinned(next);
    if ((window as any).electronAPI?.toggleAlwaysOnTop) {
      await (window as any).electronAPI.toggleAlwaysOnTop(next);
    }
  };

  const getLatencyBadge = () => {
    if (!isConnected || !telemetry) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-quantum-800 text-slate-400 border border-slate-700">
          <span className="w-2 h-2 rounded-full bg-slate-500"></span>
          OFFLINE
        </span>
      );
    }

    const { latencyMs, connectionType } = telemetry;
    let colorClass = 'text-plasma border-plasma/30 bg-plasma-dim shadow-plasma-glow';
    let dotClass = 'bg-plasma animate-ping';

    if (latencyMs > 100) {
      colorClass = 'text-alert border-alert/30 bg-alert-dim shadow-alert-glow';
      dotClass = 'bg-alert animate-ping';
    } else if (latencyMs > 70) {
      colorClass = 'text-stable border-stable/30 bg-stable-dim shadow-stable-glow';
      dotClass = 'bg-stable animate-ping';
    }

    return (
      <div className={`flex items-center gap-2 px-3 py-1 text-xs font-mono font-semibold rounded-full border transition-all ${colorClass}`}>
        <div className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${dotClass}`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotClass.split(' ')[0]}`}></span>
        </div>
        <span>{connectionType}</span>
        <span className="text-white/40">|</span>
        <span className="font-bold">{latencyMs} ms</span>
      </div>
    );
  };

  return (
    <header className="h-12 w-full bg-quantum-950/90 border-b border-quantum-800 flex items-center justify-between px-3 select-none app-drag-region z-50 backdrop-blur-md">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3 app-no-drag">
        {/* Animated Brand Rhombus Logo */}
        <div className="relative flex items-center justify-center w-7 h-7">
          <div className="absolute inset-0 bg-gradient-to-tr from-plasma to-stable rounded-sm transform rotate-45 opacity-80 animate-pulse"></div>
          <div className="absolute inset-1 bg-quantum-950 rounded-sm transform rotate-45 flex items-center justify-center">
            <Radio className="w-3.5 h-3.5 text-plasma transform -rotate-45" />
          </div>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="font-rajdhani font-bold text-lg tracking-wider text-white">
            MIRROR <span className="text-plasma">EUY</span>
          </span>
          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase hidden sm:inline">
            PRO STREAM RECEIVER
          </span>
        </div>

        {/* Live Device indicator if connected */}
        {isConnected && deviceName && (
          <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-quantum-800/80 border border-quantum-700 text-xs font-mono text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-plasma"></span>
            <span className="truncate max-w-[150px]">{deviceName}</span>
          </div>
        )}
      </div>

      {/* Middle Telemetry Pill */}
      <div className="flex items-center gap-3 app-no-drag">
        {getLatencyBadge()}
      </div>

      {/* Window Actions & Tools */}
      <div className="flex items-center gap-1 app-no-drag">
        <button
          onClick={onOpenCollab}
          title="Live Collaboration & Annotations"
          className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-plasma hover:bg-quantum-800 rounded transition-colors mr-1"
        >
          Kolaborasi
        </button>

        <button
          onClick={onOpenSettings}
          title="Pengaturan Stream & OBS"
          className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-plasma hover:bg-quantum-800 rounded transition-colors mr-1"
        >
          Pengaturan
        </button>

        <div className="h-4 w-px bg-quantum-700 mx-1"></div>

        {/* Pin Always on Top */}
        <button
          onClick={togglePin}
          title={isPinned ? 'Lepas Always On Top' : 'Kunci Always On Top (Streamer Mode)'}
          className={`p-1.5 rounded hover:bg-quantum-800 transition-colors ${
            isPinned ? 'text-plasma bg-plasma-dim' : 'text-slate-400'
          }`}
        >
          <Pin className="w-3.5 h-3.5" />
        </button>

        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="p-1.5 rounded hover:bg-quantum-800 text-slate-400 hover:text-white transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Maximize */}
        <button
          onClick={handleMaximize}
          className="p-1.5 rounded hover:bg-quantum-800 text-slate-400 hover:text-white transition-colors"
        >
          <Square className="w-3.5 h-3.5" />
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="p-1.5 rounded hover:bg-alert text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
