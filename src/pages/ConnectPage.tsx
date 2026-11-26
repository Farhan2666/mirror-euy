import React, { useState, useEffect } from 'react';
import { Wifi, Usb, RefreshCw, Smartphone, ChevronRight, Play } from 'lucide-react';
import { MirrorSession } from '../App';

interface ConnectPageProps {
  onConnect: (session: MirrorSession) => void;
}

interface UsbDevice {
  id: string;
  name: string;
  type: 'USB';
  status: 'ready' | 'unauthorized';
  serial: string;
}

interface WifiDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  type: 'WiFi';
  status: 'ready';
}

export const ConnectPage: React.FC<ConnectPageProps> = ({ onConnect }) => {
  const [scanning, setScanning] = useState(false);
  const [method, setMethod] = useState<'wifi' | 'usb'>('wifi');
  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([]);
  const [wifiDevices, setWifiDevices] = useState<WifiDevice[]>([]);
  const [localIps, setLocalIps] = useState<string[]>([]);
  const [hasAdb, setHasAdb] = useState(true);
  const [manualIp, setManualIp] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const api = (window as any).electronAPI;

  const scan = async () => {
    setScanning(true);
    setErrorMsg('');
    try {
      const [usbRes, wifiRes] = await Promise.all([
        api?.detectUsbDevices ? api.detectUsbDevices() : Promise.resolve({ hasAdb: false, devices: [] }),
        api?.detectWifiDevices ? api.detectWifiDevices() : Promise.resolve({ localIps: [], devices: [] }),
      ]);
      setHasAdb(!!usbRes.hasAdb);
      setUsbDevices(usbRes.devices || []);
      setLocalIps(wifiRes.localIps || []);
      setWifiDevices(wifiRes.devices || []);
      if (!manualIp && wifiRes.localIps?.length > 0) {
        const parts = wifiRes.localIps[0].split('.');
        if (parts.length === 4) {
          setManualIp(`${parts[0]}.${parts[1]}.${parts[2]}.`);
        }
      }
    } catch {
      setUsbDevices([]);
      setWifiDevices([]);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    scan();
  }, []);

  const handleConnectUsb = async (dev: UsbDevice) => {
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

  const handleConnectWifiDevice = (dev: WifiDevice) => {
    onConnect({
      deviceName: dev.name,
      wsUrl: `ws://${dev.ip}:${dev.port}`,
      isDemo: false,
      connectionType: 'WiFi',
    });
  };

  const handleConnectWifiManual = () => {
    const cleanIp = manualIp.trim();
    if (!cleanIp || cleanIp.endsWith('.')) {
      setErrorMsg('Masukkan alamat IP lengkap yang tampil di aplikasi Mirror Euy HP kamu.');
      return;
    }
    const url = cleanIp.startsWith('ws://') ? cleanIp : cleanIp.includes(':') ? `ws://${cleanIp}` : `ws://${cleanIp}:8888`;
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
                <p className="text-xs text-slate-400 mt-0.5">Buka <strong>Mirror Euy</strong> di HP → tekan <strong>Mulai Mirroring</strong></p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
              <div>
                <p className="text-sm font-medium text-slate-700">Satu WiFi / USB</p>
                <p className="text-xs text-slate-400 mt-0.5">Pastikan HP &amp; PC di WiFi yang sama, atau colok kabel USB</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
              <div>
                <p className="text-sm font-medium text-slate-700">Klik Hubungkan</p>
                <p className="text-xs text-slate-400 mt-0.5">Klik perangkat yang terdeteksi atau ketik IP dari layar HP</p>
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
                connectionType: 'WiFi',
              })
            }
            className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:border-brand hover:text-brand transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Coba Mode Simulasi (Tanpa HP)
          </button>

          {localIps.length > 0 && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 mb-0.5">IP WiFi PC Kamu</p>
              <p className="text-xs font-mono text-blue-600">{localIps.join(', ')}</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Area ── */}
      <main className="flex-1 flex flex-col p-8 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-800">Hubungkan Perangkat</h1>
          <p className="text-sm text-slate-400 mt-1">Pastikan tombol <strong>Mulai Mirroring</strong> di HP sudah ditekan sebelum memindai</p>
        </div>

        {/* Method Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setMethod('wifi'); setErrorMsg(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              method === 'wifi'
                ? 'bg-brand text-white border-brand'
                : 'bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand'
            }`}
          >
            <Wifi className="w-4 h-4" />
            WiFi / LAN ({wifiDevices.length})
          </button>
          <button
            onClick={() => { setMethod('usb'); setErrorMsg(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              method === 'usb'
                ? 'bg-brand text-white border-brand'
                : 'bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand'
            }`}
          >
            <Usb className="w-4 h-4" />
            Kabel USB ({usbDevices.length})
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600">
            {errorMsg}
          </div>
        )}

        {/* WiFi Mode */}
        {method === 'wifi' && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">
                {scanning ? 'Memindai jaringan WiFi (port 8888)...' : `${wifiDevices.length} perangkat WiFi terdeteksi`}
              </p>
              <button
                onClick={scan}
                disabled={scanning}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-dark font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                {scanning ? 'Memindai...' : 'Pindai Ulang'}
              </button>
            </div>

            {wifiDevices.length > 0 ? (
              <div className="flex flex-col gap-2">
                {wifiDevices.map(dev => (
                  <div
                    key={dev.id}
                    className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-brand hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-brand" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{dev.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          <span className="text-xs text-slate-400 font-mono">ws://{dev.ip}:{dev.port}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleConnectWifiDevice(dev)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors"
                    >
                      Hubungkan
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
                <Wifi className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">
                  {scanning ? 'Sedang mencari HP di jaringan WiFi...' : 'Belum ada HP yang terdeteksi otomatis'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Pastikan di HP kamu sudah menekan <strong>Mulai Mirroring</strong> (status LIVE), lalu klik <strong>Pindai Ulang</strong>.
                </p>
              </div>
            )}

            {/* Manual IP fallback */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white">
              <p className="text-sm font-medium text-slate-700 mb-1">Atau Masukkan IP HP Manual</p>
              <p className="text-xs text-slate-400 mb-3">
                Ketik angka IP yang tampil di aplikasi Mirror Euy HP kamu (tanpa port, atau lengkap dengan `:8888`):
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
                  onClick={handleConnectWifiManual}
                  className="px-5 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors"
                >
                  Hubungkan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* USB Mode */}
        {method === 'usb' && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">
                {scanning ? 'Mencari perangkat USB...' : `${usbDevices.length} perangkat USB terdeteksi`}
              </p>
              <button
                onClick={scan}
                disabled={scanning}
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
      </main>
    </div>
  );
};
