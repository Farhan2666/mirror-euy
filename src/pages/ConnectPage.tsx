import React, { useState, useEffect } from 'react';
import { Wifi, Usb, RefreshCw, Smartphone, ChevronRight, Play } from 'lucide-react';
import { MirrorSession } from '../App';

interface ConnectPageProps {
  onConnect: (session: MirrorSession) => void;
}

interface DetectedDevice {
  id: string;
  name: string;
  type: 'USB' | 'WiFi';
  status: 'ready' | 'unauthorized';
  serial: string;
}

export const ConnectPage: React.FC<ConnectPageProps> = ({ onConnect }) => {
  const [scanning, setScanning] = useState(false);
  const [method, setMethod] = useState<'usb' | 'wifi'>('usb');
  const [usbDevices, setUsbDevices] = useState<DetectedDevice[]>([]);
  const [hasAdb, setHasAdb] = useState(true);
  const [manualIp, setManualIp] = useState('192.168.1.');
  const [errorMsg, setErrorMsg] = useState('');

  const api = (window as any).electronAPI;

  const scan = async () => {
    setScanning(true);
    setErrorMsg('');
    try {
      if (api?.detectUsbDevices) {
        const res = await api.detectUsbDevices();
        setHasAdb(!!res.hasAdb);
        setUsbDevices(res.devices || []);
      } else {
        setUsbDevices([]);
      }
    } catch {
      setUsbDevices([]);
    } finally {
      setTimeout(() => setScanning(false), 500);
    }
  };

  useEffect(() => {
    scan();
  }, []);

  const handleConnectUsb = async (dev: DetectedDevice) => {
    setErrorMsg('');
    if (dev.status !== 'ready') {
      setErrorMsg('HP belum diizinkan. Cek layar HP dan tekan "Allow USB Debugging".');
      return;
    }
    if (api?.adbForward) {
      const fwd = await api.adbForward(dev.serial);
      if (!fwd?.success) {
        setErrorMsg(`Gagal forward port ADB: ${fwd?.error || 'Unknown error'}`);
        return;
      }
    }
    onConnect({
      deviceName: dev.name,
      wsUrl: 'ws://127.0.0.1:8888',
      isDemo: false,
      connectionType: 'USB',
    });
  };

  const handleConnectWifi = () => {
    const cleanIp = manualIp.trim();
    if (!cleanIp || cleanIp.endsWith('.')) {
      setErrorMsg('Masukkan alamat IP lengkap yang tampil di aplikasi Mirror Euy HP kamu.');
      return;
    }
    const url = cleanIp.startsWith('ws://') ? cleanIp : `ws://${cleanIp}:8888`;
    onConnect({
      deviceName: `WiFi (${cleanIp})`,
      wsUrl: url,
      isDemo: false,
      connectionType: 'WiFi',
    });
  };

  return (
    <div className="flex h-full">
      {/* ── Left Sidebar: Steps ── */}
      <aside className="w-64 border-r border-slate-100 bg-slate-50 flex flex-col p-5 gap-6">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Cara Koneksi</p>
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
              <div>
                <p className="text-sm font-medium text-slate-700">Buka App di HP</p>
                <p className="text-xs text-slate-400 mt-0.5">Buka aplikasi <strong>Mirror Euy</strong> Android &amp; tekan Mulai Mirroring</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
              <div>
                <p className="text-sm font-medium text-slate-700">Pilih USB / WiFi</p>
                <p className="text-xs text-slate-400 mt-0.5">Colok kabel USB (USB Debugging aktif) atau pakai IP WiFi</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
              <div>
                <p className="text-sm font-medium text-slate-700">Hubungkan</p>
                <p className="text-xs text-slate-400 mt-0.5">Layar HP langsung tampil real-time di PC</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <button
            onClick={() =>
              onConnect({
                deviceName: 'Mode Simulasi (Demo)',
                wsUrl: '',
                isDemo: true,
                connectionType: 'USB',
              })
            }
            className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:border-brand hover:text-brand transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Coba Mode Simulasi (Tanpa HP)
          </button>

          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-1">💡 Info</p>
            <p className="text-xs text-blue-600">
              Source code Android app tersedia di folder <code className="font-mono">android/</code>.
            </p>
          </div>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <main className="flex-1 flex flex-col p-8 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-800">Hubungkan Perangkat</h1>
          <p className="text-sm text-slate-400 mt-1">Pilih metode koneksi ke aplikasi Mirror Euy di HP Android kamu</p>
        </div>

        {/* Method Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setMethod('usb'); setErrorMsg(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              method === 'usb'
                ? 'bg-brand text-white border-brand'
                : 'bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand'
            }`}
          >
            <Usb className="w-4 h-4" />
            Kabel USB (ADB)
          </button>
          <button
            onClick={() => { setMethod('wifi'); setErrorMsg(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              method === 'wifi'
                ? 'bg-brand text-white border-brand'
                : 'bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand'
            }`}
          >
            <Wifi className="w-4 h-4" />
            WiFi / LAN
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600">
            {errorMsg}
          </div>
        )}

        {/* USB Mode */}
        {method === 'usb' && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">
                {scanning ? 'Mencari perangkat USB...' : `${usbDevices.length} perangkat terdeteksi`}
              </p>
              <button
                onClick={scan}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-dark font-medium transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                Pindai Ulang
              </button>
            </div>

            {usbDevices.length > 0 ? (
              <div className="flex flex-col gap-2">
                {usbDevices.map(dev => (
                  <div
                    key={dev.id}
                    className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-brand hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{dev.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${dev.status === 'ready' ? 'bg-green-500' : 'bg-orange-400'}`}></span>
                          <span className="text-xs text-slate-400">
                            USB · {dev.serial} · {dev.status === 'ready' ? 'Siap' : 'Perlu izinkan USB Debugging di HP'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleConnectUsb(dev)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors"
                    >
                      Hubungkan
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
                <Usb className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">
                  {hasAdb ? 'Belum ada HP yang terhubung via USB' : 'ADB belum terdeteksi di PATH'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Colokkan HP ke PC dengan kabel data, aktifkan <strong>USB Debugging</strong> di Developer Options, lalu klik <strong>Pindai Ulang</strong>.
                </p>
              </div>
            )}
          </div>
        )}

        {/* WiFi Mode */}
        {method === 'wifi' && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="p-5 rounded-xl border border-slate-200 bg-white">
              <p className="text-sm font-medium text-slate-700 mb-1">Masukkan Alamat IP HP</p>
              <p className="text-xs text-slate-400 mb-3">
                Buka aplikasi <strong>Mirror Euy</strong> di HP (pastikan satu WiFi dengan PC), lalu masukkan IP yang tampil di layar HP:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  placeholder="Contoh: 192.168.1.105"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand text-slate-700"
                />
                <button
                  onClick={handleConnectWifi}
                  className="px-5 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors"
                >
                  Hubungkan
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
