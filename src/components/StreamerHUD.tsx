import React from 'react';
import { 
  Activity, 
  Wifi, 
  Usb, 
  MessageSquare, 
  Users, 
  TrendingUp, 
  Layers, 
  AlertTriangle,
  Flame
} from 'lucide-react';
import { TelemetryMetrics, ChatMessage } from '../types';

interface StreamerHUDProps {
  telemetry: TelemetryMetrics;
  chatMessages: ChatMessage[];
  showChat: boolean;
  showTelemetry: boolean;
  viewerCount: number;
  gameTitle: string;
}

export const StreamerHUD: React.FC<StreamerHUDProps> = ({
  telemetry,
  chatMessages,
  showChat,
  showTelemetry,
  viewerCount,
  gameTitle
}) => {
  const { latencyMs, fps, bitrateMbps, droppedFrames, cpuUsage, connectionType } = telemetry;

  // Determine badge styling based on latency
  let latencyColor = 'text-plasma';
  let latencyBg = 'bg-plasma-dim border-plasma/30';
  if (latencyMs > 100) {
    latencyColor = 'text-alert';
    latencyBg = 'bg-alert-dim border-alert/30';
  } else if (latencyMs > 70) {
    latencyColor = 'text-stable';
    latencyBg = 'bg-stable-dim border-stable/30';
  }

  return (
    <>
      {/* Top Left Game & Viewer Badge */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-quantum-950/80 backdrop-blur-md border border-quantum-700 text-xs font-mono shadow-xl">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          <span className="font-bold text-white uppercase">{gameTitle}</span>
          <span className="text-slate-500">|</span>
          <span className="flex items-center gap-1 text-slate-300">
            <Users className="w-3.5 h-3.5 text-plasma" />
            {viewerCount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Top Right Latency & Telemetry Meter */}
      {showTelemetry && (
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 pointer-events-none items-end">
          {/* Main Latency Card */}
          <div className={`px-3.5 py-2 rounded-xl backdrop-blur-md border font-mono shadow-2xl transition-all ${latencyBg}`}>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-start">
                <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
                  MIRROR LATENCY
                </span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-black tracking-tight ${latencyColor}`}>
                    {latencyMs}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">ms</span>
                </div>
              </div>

              <div className="h-8 w-px bg-white/10"></div>

              <div className="flex flex-col text-[11px] gap-0.5">
                <div className="flex items-center justify-between gap-3 text-slate-300">
                  <span className="text-slate-400">FPS:</span>
                  <span className="font-bold text-white">{fps}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-slate-300">
                  <span className="text-slate-400">BITRATE:</span>
                  <span className="font-bold text-plasma">{bitrateMbps.toFixed(1)} Mb/s</span>
                </div>
              </div>
            </div>

            {/* Sub-bar metrics */}
            <div className="flex items-center justify-between gap-3 mt-1.5 pt-1.5 border-t border-white/10 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                {connectionType.includes('USB') ? (
                  <Usb className="w-3 h-3 text-plasma" />
                ) : (
                  <Wifi className="w-3 h-3 text-stable" />
                )}
                {connectionType}
              </span>
              <span>CPU: {cpuUsage}%</span>
              <span>Loss: {droppedFrames > 0 ? `${droppedFrames}f` : '0%'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Twitch / YouTube Live Chat Overlay (Draggable / Semi-transparent streamer overlay) */}
      {showChat && (
        <div className="absolute bottom-24 left-4 z-20 max-w-xs w-full pointer-events-none">
          <div className="bg-quantum-950/75 backdrop-blur-md border border-quantum-700/60 rounded-xl p-3 shadow-2xl flex flex-col gap-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-quantum-800 text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-1.5 text-plasma">
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="font-bold uppercase tracking-wider">Stream Chat Overlay</span>
              </div>
              <span className="text-[10px] bg-quantum-800 px-1.5 py-0.5 rounded text-slate-300">LIVE</span>
            </div>

            <div className="flex flex-col gap-1.5 max-h-48 overflow-hidden">
              {chatMessages.slice(-4).map((msg) => (
                <div key={msg.id} className="text-xs leading-tight animate-fadeIn">
                  <span 
                    className="font-bold mr-1.5 font-mono" 
                    style={{ color: msg.color || '#00FFC1' }}
                  >
                    {msg.user}:
                  </span>
                  <span className="text-slate-200">{msg.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
