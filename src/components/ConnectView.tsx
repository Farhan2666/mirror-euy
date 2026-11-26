import React, { useState } from 'react';
import { 
  Smartphone, 
  Usb, 
  Wifi, 
  BatteryCharging, 
  Zap, 
  RefreshCw, 
  Play, 
  HelpCircle,
  AlertCircle,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react';
import { Device, ConnectionType } from '../types';

interface ConnectViewProps {
  devices: Device[];
  isScanning: boolean;
  onRefreshDevices: () => void;
  onConnectDevice: (device: Device) => void;
  onStartDemo: () => void;
}

export const ConnectView: React.FC<ConnectViewProps> = ({
  devices,
  isScanning,
  onRefreshDevices,
  onConnectDevice,
  onStartDemo
}) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(devices[0]?.id || '');
  const [connectionMode, setConnectionMode] = useState<'auto' | 'usb' | 'wifi'>('auto');

  const selectedDevice = devices.find(d => d.id === selectedDeviceId) || devices[0];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-y-auto">
      {/* Background Cyber Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0F0F1E_1px,transparent_1px),linear-gradient(to_bottom,#0F0F1E_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none"></div>

      <div className="max-w-3xl w-full z-10 flex flex-col items-center">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-plasma-dim border border-plasma/30 text-plasma text-xs font-mono font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>WIRE-GRADE ULTRA LOW-LATENCY MIRRORING</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-rajdhani font-bold tracking-tight text-white mb-2">
            CONNECT TO <span className="text-transparent bg-clip-text bg-gradient-to-r from-plasma to-stable">MIRROR EUY</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Mirroring layar smartphone ke PC dengan latensi sub-50ms untuk streamers esports, tanpa capture card mahal.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center bg-quantum-850 p-1 rounded-xl border border-quantum-700 mb-6 text-xs font-mono">
          <button
            onClick={() => setConnectionMode('auto')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              connectionMode === 'auto'
                ? 'bg-plasma text-quantum-950 font-bold shadow-plasma-glow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Auto Hybrid Failover
          </button>
          <button
            onClick={() => setConnectionMode('usb')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              connectionMode === 'usb'
                ? 'bg-stable text-white font-bold shadow-stable-glow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Usb className="w-3.5 h-3.5" />
            Prioritas USB 3.0
          </button>
          <button
            onClick={() => setConnectionMode('wifi')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              connectionMode === 'wifi'
                ? 'bg-purple-600 text-white font-bold shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            Prioritas WiFi 6
          </button>
        </div>

        {/* Devices Panel */}
        <div className="w-full bg-quantum-850/80 backdrop-blur-xl border border-quantum-700/80 rounded-2xl p-6 shadow-2xl mb-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-quantum-700">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-plasma" />
              <h2 className="text-sm font-rajdhani font-bold uppercase tracking-wider text-white">
                Perangkat Terdeteksi ({devices.length})
              </h2>
            </div>

            <button
              onClick={onRefreshDevices}
              disabled={isScanning}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-plasma transition-colors font-mono disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-plasma' : ''}`} />
              {isScanning ? 'Memindai...' : 'Pindai Ulang'}
            </button>
          </div>

          {/* Device Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {devices.map((device) => {
              const isSelected = selectedDeviceId === device.id;
              const isUsb = device.type.includes('USB');

              return (
                <div
                  key={device.id}
                  onClick={() => setSelectedDeviceId(device.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
                    isSelected
                      ? 'bg-quantum-800 border-plasma/60 shadow-plasma-glow'
                      : 'bg-quantum-900/60 border-quantum-700/60 hover:border-quantum-600'
                  }`}
                >
                  {/* Selected Indicator */}
                  {isSelected && (
                    <div className="absolute top-0 right-0 w-8 h-8 overflow-hidden">
                      <div className="bg-plasma absolute transform rotate-45 translate-x-4 -translate-y-4 w-8 h-8"></div>
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${isUsb ? 'bg-plasma-dim text-plasma' : 'bg-stable-dim text-stable'}`}>
                        {isUsb ? <Usb className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-white group-hover:text-plasma transition-colors">
                          {device.name}
                        </h3>
                        <p className="text-[11px] font-mono text-slate-400">
                          {device.port} • {device.ip}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-quantum-700/50 text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <BatteryCharging className="w-3.5 h-3.5 text-green-400" />
                      <span>{device.battery}%</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-plasma font-semibold">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Est. ~{device.latencyEst} ms</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Connect Action Button */}
          {selectedDevice && (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => onConnectDevice(selectedDevice)}
                className="w-full sm:flex-1 py-3.5 px-6 rounded-xl font-rajdhani font-bold text-base tracking-wider uppercase bg-gradient-to-r from-plasma to-teal-400 hover:from-plasma-hover hover:to-teal-300 text-quantum-950 shadow-plasma-glow flex items-center justify-center gap-2 transition-all transform active:scale-[0.99]"
              >
                <Play className="w-4 h-4 fill-current" />
                Hubungkan & Mulai Mirroring ({selectedDevice.type})
              </button>

              <button
                onClick={onStartDemo}
                className="w-full sm:w-auto py-3.5 px-4 rounded-xl font-rajdhani font-semibold text-xs tracking-wider uppercase bg-quantum-800 hover:bg-quantum-700 text-slate-300 hover:text-white border border-quantum-600 transition-all flex items-center justify-center gap-2"
                title="Mulai simulasi feed gameplay live untuk pengujian tanpa smartphone fisik"
              >
                <Layers className="w-4 h-4 text-plasma" />
                Uji Demo Feed (Esports)
              </button>
            </div>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full text-xs font-mono text-slate-400">
          <div className="p-3 rounded-lg bg-quantum-900/40 border border-quantum-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-plasma shrink-0" />
            <span>Sub-50ms Hardware Accelerated Latency</span>
          </div>
          <div className="p-3 rounded-lg bg-quantum-900/40 border border-quantum-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-stable shrink-0" />
            <span>Zero-Blackout Auto USB/WiFi Failover</span>
          </div>
          <div className="p-3 rounded-lg bg-quantum-900/40 border border-quantum-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Native OBS Scene Switcher & Twitch HUD</span>
          </div>
        </div>
      </div>
    </div>
  );
};
