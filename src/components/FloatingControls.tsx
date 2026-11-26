import React, { useState, useEffect } from 'react';
import { 
  Circle, 
  Square, 
  RotateCw, 
  Layers, 
  PenTool, 
  Trash2, 
  Power, 
  Sliders, 
  Tv, 
  Mic, 
  MicOff,
  Video,
  Volume2,
  Share2,
  Check
} from 'lucide-react';
import { CodecMode } from '../types';

interface FloatingControlsProps {
  isRecording: boolean;
  onToggleRecord: () => void;
  codec: CodecMode;
  onChangeCodec: (codec: CodecMode) => void;
  orientation: 'landscape' | 'portrait';
  onToggleOrientation: () => void;
  isAnnotating: boolean;
  onToggleAnnotate: () => void;
  activeColor: string;
  onChangeColor: (color: string) => void;
  onClearAnnotations: () => void;
  onDisconnect: () => void;
  onOpenCollab: () => void;
  obsScene: string;
  onSwitchObsScene: (scene: string) => void;
}

export const FloatingControls: React.FC<FloatingControlsProps> = ({
  isRecording,
  onToggleRecord,
  codec,
  onChangeCodec,
  orientation,
  onToggleOrientation,
  isAnnotating,
  onToggleAnnotate,
  activeColor,
  onChangeColor,
  onClearAnnotations,
  onDisconnect,
  onOpenCollab,
  obsScene,
  onSwitchObsScene,
}) => {
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [showObsMenu, setShowObsMenu] = useState(false);
  const [showCodecMenu, setShowCodecMenu] = useState(false);
  const [micMuted, setMicMuted] = useState(false);

  // Recording timer
  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordSeconds(s => s + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const colors = ['#00FFC1', '#0066FF', '#FF2E4D', '#F59E0B', '#FFFFFF'];
  const obsScenes = ['Gameplay (Active)', 'Facecam + Game', 'Just Chatting', 'BRB Screen'];

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
      {/* Main Floating Cyber Dock */}
      <div className="flex items-center gap-1.5 p-1.5 bg-quantum-950/90 backdrop-blur-xl border border-quantum-700/80 rounded-2xl shadow-2xl">
        {/* Record Button */}
        <button
          onClick={onToggleRecord}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-mono text-xs font-bold transition-all ${
            isRecording
              ? 'bg-alert text-white shadow-alert-glow animate-pulse'
              : 'bg-quantum-850 hover:bg-quantum-800 text-slate-200 hover:text-white border border-quantum-700'
          }`}
          title={isRecording ? 'Hentikan & Simpan Rekaman' : 'Mulai Rekam Layar & Audio HP'}
        >
          {isRecording ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>REC {formatTime(recordSeconds)}</span>
            </>
          ) : (
            <>
              <Circle className="w-3.5 h-3.5 fill-red-500 text-red-500" />
              <span>RECORD</span>
            </>
          )}
        </button>

        <div className="h-6 w-px bg-quantum-800 mx-1"></div>

        {/* Codec Toggle Dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowCodecMenu(!showCodecMenu); setShowObsMenu(false); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-quantum-850 hover:bg-quantum-800 border border-quantum-700 text-xs font-mono font-semibold text-slate-200 hover:text-plasma transition-all"
            title="Pilih Video Codec"
          >
            <Sliders className="w-3.5 h-3.5 text-plasma" />
            <span>{codec === 'PNG_LOSSLESS' ? 'PNG LOSSLESS' : codec}</span>
          </button>

          {showCodecMenu && (
            <div className="absolute bottom-full mb-2 left-0 w-44 bg-quantum-900 border border-quantum-700 rounded-xl p-1.5 shadow-2xl flex flex-col gap-1 z-40 text-xs font-mono">
              <button
                onClick={() => { onChangeCodec('HEVC'); setShowCodecMenu(false); }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                  codec === 'HEVC' ? 'bg-plasma text-quantum-950 font-bold' : 'text-slate-300 hover:bg-quantum-800'
                }`}
              >
                <span>HEVC (H.265)</span>
                {codec === 'HEVC' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => { onChangeCodec('PNG_LOSSLESS'); setShowCodecMenu(false); }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                  codec === 'PNG_LOSSLESS' ? 'bg-plasma text-quantum-950 font-bold' : 'text-slate-300 hover:bg-quantum-800'
                }`}
              >
                <span>Lossless (PNG)</span>
                {codec === 'PNG_LOSSLESS' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => { onChangeCodec('H.264'); setShowCodecMenu(false); }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                  codec === 'H.264' ? 'bg-plasma text-quantum-950 font-bold' : 'text-slate-300 hover:bg-quantum-800'
                }`}
              >
                <span>H.264 High</span>
                {codec === 'H.264' && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>

        {/* OBS Scene Switcher */}
        <div className="relative">
          <button
            onClick={() => { setShowObsMenu(!showObsMenu); setShowCodecMenu(false); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-quantum-850 hover:bg-quantum-800 border border-quantum-700 text-xs font-mono font-semibold text-slate-200 hover:text-stable transition-all"
            title="OBS Scene Auto-Switcher"
          >
            <Tv className="w-3.5 h-3.5 text-stable" />
            <span className="truncate max-w-[100px]">{obsScene}</span>
          </button>

          {showObsMenu && (
            <div className="absolute bottom-full mb-2 left-0 w-48 bg-quantum-900 border border-quantum-700 rounded-xl p-1.5 shadow-2xl flex flex-col gap-1 z-40 text-xs font-mono">
              <div className="px-2 py-1 text-[10px] text-slate-500 font-bold uppercase border-b border-quantum-800">
                OBS Websockets (Port 4455)
              </div>
              {obsScenes.map(scene => (
                <button
                  key={scene}
                  onClick={() => { onSwitchObsScene(scene); setShowObsMenu(false); }}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    obsScene === scene ? 'bg-stable text-white font-bold' : 'text-slate-300 hover:bg-quantum-800'
                  }`}
                >
                  <span className="truncate">{scene}</span>
                  {obsScene === scene && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-quantum-800 mx-1"></div>

        {/* Orientation Toggle */}
        <button
          onClick={onToggleOrientation}
          className="p-2 rounded-xl bg-quantum-850 hover:bg-quantum-800 text-slate-300 hover:text-white border border-quantum-700 transition-colors"
          title={`Putar Layar (${orientation === 'landscape' ? 'Landscape ke Portrait' : 'Portrait ke Landscape'})`}
        >
          <RotateCw className="w-4 h-4" />
        </button>

        {/* Annotate Toggle */}
        <button
          onClick={onToggleAnnotate}
          className={`p-2 rounded-xl border transition-all ${
            isAnnotating
              ? 'bg-plasma text-quantum-950 font-bold shadow-plasma-glow border-plasma'
              : 'bg-quantum-850 hover:bg-quantum-800 text-slate-300 hover:text-white border-quantum-700'
          }`}
          title="Mode Anotasi & Coret Layar"
        >
          <PenTool className="w-4 h-4" />
        </button>

        {/* Audio Mute Toggle */}
        <button
          onClick={() => setMicMuted(!micMuted)}
          className={`p-2 rounded-xl border transition-colors ${
            micMuted
              ? 'bg-alert-dim text-alert border-alert/30'
              : 'bg-quantum-850 hover:bg-quantum-800 text-slate-300 hover:text-white border-quantum-700'
          }`}
          title={micMuted ? 'Nyalakan Audio Stream' : 'Bisukan Audio Stream'}
        >
          {micMuted ? <MicOff className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Collaboration Modal Trigger */}
        <button
          onClick={onOpenCollab}
          className="p-2 rounded-xl bg-quantum-850 hover:bg-quantum-800 text-slate-300 hover:text-plasma border border-quantum-700 transition-colors"
          title="Buka Kolaborasi Multi-User"
        >
          <Share2 className="w-4 h-4" />
        </button>

        <div className="h-6 w-px bg-quantum-800 mx-1"></div>

        {/* Disconnect Button */}
        <button
          onClick={onDisconnect}
          className="p-2 rounded-xl bg-quantum-850 hover:bg-alert-dim text-slate-400 hover:text-alert border border-quantum-700 hover:border-alert/30 transition-all"
          title="Putuskan Koneksi"
        >
          <Power className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Color Palette for Annotation Mode */}
      {isAnnotating && (
        <div className="flex items-center gap-1.5 p-1.5 bg-quantum-950/90 backdrop-blur-xl border border-quantum-700 rounded-2xl shadow-xl animate-fadeIn">
          {colors.map(c => (
            <button
              key={c}
              onClick={() => onChangeColor(c)}
              className={`w-6 h-6 rounded-full transition-transform ${
                activeColor === c ? 'scale-125 ring-2 ring-white shadow-lg' : 'hover:scale-110 opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}

          <div className="h-4 w-px bg-quantum-800 mx-1"></div>

          <button
            onClick={onClearAnnotations}
            className="p-1 text-slate-400 hover:text-alert transition-colors"
            title="Hapus Semua Coretan"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
