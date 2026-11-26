import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  BatteryCharging, 
  Usb, 
  Tv, 
  Cpu, 
  Zap, 
  Sliders,
  CheckCircle,
  Save
} from 'lucide-react';
import { StreamConfig, ObsProfile } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: StreamConfig;
  onSaveConfig: (config: StreamConfig) => void;
  obsProfile: ObsProfile;
  onSaveObs: (profile: ObsProfile) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  obsProfile,
  onSaveObs
}) => {
  const [localConfig, setLocalConfig] = useState<StreamConfig>(config);
  const [localObs, setLocalObs] = useState<ObsProfile>(obsProfile);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig(localConfig);
    onSaveObs(localObs);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xl bg-quantum-900 border border-quantum-700 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-quantum-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="p-2.5 rounded-xl bg-plasma-dim text-plasma border border-plasma/30">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-rajdhani font-bold uppercase tracking-wider text-white">
              Pengaturan Mirror Euy
            </h2>
            <p className="text-xs text-slate-400">
              Konfigurasi latensi, enkoder hardware, OBS Websocket, dan optimasi baterai
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Section 1: Resolusi & Frame Rate */}
          <div className="p-4 rounded-xl bg-quantum-850 border border-quantum-800">
            <h3 className="text-xs font-mono font-bold uppercase text-slate-300 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-plasma" />
              Performa Stream & Resolusi
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">
                  RESOLUSI STREAM
                </label>
                <select
                  value={localConfig.resolution}
                  onChange={e => setLocalConfig({ ...localConfig, resolution: e.target.value as any })}
                  className="w-full bg-quantum-950 border border-quantum-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-plasma"
                >
                  <option value="720p">720p (Lowest Latency)</option>
                  <option value="1080p">1080p FHD (Recommended)</option>
                  <option value="1440p">1440p 2K (High Quality)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">
                  TARGET FRAME RATE
                </label>
                <select
                  value={localConfig.framerate}
                  onChange={e => setLocalConfig({ ...localConfig, framerate: Number(e.target.value) as any })}
                  className="w-full bg-quantum-950 border border-quantum-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-plasma"
                >
                  <option value={30}>30 FPS (Hemat Daya)</option>
                  <option value={60}>60 FPS (Standar Smooth)</option>
                  <option value={90}>90 FPS (Esports Ultra)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Auto-Failover & Baterai */}
          <div className="p-4 rounded-xl bg-quantum-850 border border-quantum-800 space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase text-slate-300 mb-1 flex items-center gap-2">
              <Usb className="w-4 h-4 text-stable" />
              Keandalan Jaringan & Daya
            </h3>

            {/* Auto USB Failover */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">Auto USB/WiFi Failover</div>
                <div className="text-[11px] text-slate-400">
                  Secara otomatis beralih jika packet loss &gt; 5% atau sinyal lemah tanpa putus live
                </div>
              </div>
              <input
                type="checkbox"
                checked={localConfig.autoFailover}
                onChange={e => setLocalConfig({ ...localConfig, autoFailover: e.target.checked })}
                className="w-4 h-4 accent-plasma rounded cursor-pointer"
              />
            </div>

            <div className="h-px bg-quantum-800"></div>

            {/* Battery Saver */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">Battery Optimization Alert</div>
                <div className="text-[11px] text-slate-400">
                  Turunkan beban komputasi dan beri notifikasi ketika baterai HP di bawah 20%
                </div>
              </div>
              <input
                type="checkbox"
                checked={localConfig.batteryOptimization}
                onChange={e => setLocalConfig({ ...localConfig, batteryOptimization: e.target.checked })}
                className="w-4 h-4 accent-plasma rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Section 3: OBS Studio Websocket */}
          <div className="p-4 rounded-xl bg-quantum-850 border border-quantum-800">
            <h3 className="text-xs font-mono font-bold uppercase text-slate-300 mb-3 flex items-center gap-2">
              <Tv className="w-4 h-4 text-purple-400" />
              Integrasi OBS Studio Websockets
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">
                  WEBSOCKET PORT
                </label>
                <input
                  type="number"
                  value={localObs.port}
                  onChange={e => setLocalObs({ ...localObs, port: Number(e.target.value) })}
                  className="w-full bg-quantum-950 border border-quantum-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-plasma"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">
                  STATUS KONEKSI
                </label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-quantum-950 border border-quantum-700 text-xs font-mono text-plasma font-semibold">
                  <span className="w-2 h-2 rounded-full bg-plasma animate-ping"></span>
                  OBS Connected (v5.x API)
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white transition-colors"
            >
              Batal
            </button>

            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-rajdhani font-bold text-sm tracking-wider uppercase bg-plasma hover:bg-plasma-hover text-quantum-950 shadow-plasma-glow transition-all"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Tersimpan!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
