import React, { useState, useEffect, useRef } from 'react';
import {
  Circle, Square, RotateCw, PenTool, Volume2, VolumeX,
  Camera, Power, Wifi, Usb, Clock, RefreshCw, Maximize2, Minimize2
} from 'lucide-react';
import { MirrorSession } from '../App';

interface MirrorPageProps {
  session: MirrorSession;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onDisconnect: () => void;
}

export const MirrorPage: React.FC<MirrorPageProps> = ({
  session,
  isFullScreen,
  onToggleFullScreen,
  onDisconnect,
}) => {
  const [status, setStatus] = useState<'connecting' | 'live' | 'error'>(session.isDemo ? 'live' : 'connecting');
  const [statusText, setStatusText] = useState(session.isDemo ? 'Simulasi Aktif' : 'Menghubungkan ke HP...');
  const [fps, setFps] = useState(session.isDemo ? 60 : 0);
  const [latency, setLatency] = useState(session.isDemo ? 42 : 0);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [canvasSize, setCanvasSize] = useState({ width: 540, height: 1170 });
  const [boxSize, setBoxSize] = useState({ width: 800, height: 600 });

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  // Web Audio API PCM16 player refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextAudioTimeRef = useRef<number>(0);

  const playPcmAudio = (pcmBytes: Uint8Array) => {
    if (isMutedRef.current) return;
    try {
      // Standar 48000 Hz Stereo (2 channel interleaved L/R) persis seperti Vysor
      const SAMPLE_RATE = 48000;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext({ latencyHint: 'interactive', sampleRate: SAMPLE_RATE });
        nextAudioTimeRef.current = audioCtxRef.current.currentTime;
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
        return;
      }

      // Setiap frame audio: 4 byte = 2 byte L (Int16) + 2 byte R (Int16)
      const frameCount = Math.floor(pcmBytes.byteLength / 4);
      if (frameCount <= 0) return;

      const view = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength);
      const audioBuffer = ctx.createBuffer(2, frameCount, SAMPLE_RATE);
      const leftChannel = audioBuffer.getChannelData(0);
      const rightChannel = audioBuffer.getChannelData(1);

      for (let i = 0; i < frameCount; i++) {
        leftChannel[i] = view.getInt16(i * 4, true) / 32768;
        rightChannel[i] = view.getInt16(i * 4 + 2, true) / 32768;
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      // Sinkronisasi buffer agar tidak delay dan tidak stuttering
      if (nextAudioTimeRef.current < now || nextAudioTimeRef.current - now > 0.25) {
        nextAudioTimeRef.current = now + 0.03;
      }
      source.start(nextAudioTimeRef.current);
      nextAudioTimeRef.current += audioBuffer.duration;
    } catch {}
  };

  // Unlock AudioContext saat user klik canvas
  const unlockAudio = () => {
    if (audioUnlocked) return;
    setAudioUnlocked(true);
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 });
      nextAudioTimeRef.current = audioCtxRef.current.currentTime;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  };

  // Real WebSocket stream receiver
  const connectWebSocket = () => {
    if (session.isDemo) return;
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus('connecting');
    setStatusText(`Menghubungkan ke ${session.wsUrl}...`);

    const ws = new WebSocket(session.wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    let frameCount = 0;
    let lastFpsTick = performance.now();
    let lastFrameArrival = performance.now();
    let isDecoding = false;
    let pendingFrame: Uint8Array | null = null;

    const decodeAndDraw = async (frameBytes: Uint8Array) => {
      isDecoding = true;
      try {
        const jpegBlob = new Blob([new Uint8Array(frameBytes)], { type: 'image/jpeg' });
        const bitmap = await createImageBitmap(jpegBlob);
        const canvas = canvasRef.current;
        if (canvas) {
          if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            setCanvasSize({ width: bitmap.width, height: bitmap.height });
            setOrientation(bitmap.width > bitmap.height ? 'landscape' : 'portrait');
          }
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(bitmap, 0, 0);
        }
        bitmap.close();
        setStatusText('Live');
      } catch {
      } finally {
        isDecoding = false;
        if (pendingFrame) {
          const next = pendingFrame;
          pendingFrame = null;
          decodeAndDraw(next);
        }
      }
    };

    ws.onopen = () => {
      setStatus('live');
      setStatusText('Terhubung (Menunggu frame...)');
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const info = JSON.parse(event.data);
          if (info.type === 'info' && info.width && info.height) {
            setCanvasSize({ width: info.width, height: info.height });
            setOrientation(info.width > info.height ? 'landscape' : 'portrait');
          }
        } catch {}
        return;
      }

      const buf = new Uint8Array(event.data as ArrayBuffer);
      if (buf.length < 2) return;

      // 0x02 = PCM16 Audio chunk
      if (buf[0] === 0x02) {
        playPcmAudio(buf.subarray(1));
        return;
      }

      // 0x01 = JPEG Video frame
      if (buf[0] !== 0x01) return;

      const now = performance.now();
      const delta = Math.round(now - lastFrameArrival);
      lastFrameArrival = now;
      if (delta > 0 && delta < 500) setLatency(delta);

      frameCount++;
      if (now - lastFpsTick >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastFpsTick = now;
      }

      const jpegData = buf.subarray(1);
      if (isDecoding) {
        pendingFrame = jpegData;
      } else {
        decodeAndDraw(jpegData);
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setStatusText('Gagal terhubung. Pastikan app Mirror Euy di HP sudah "Mulai Mirroring".');
    };

    ws.onclose = () => {
      setStatus('error');
      setStatusText((prev) => (prev.startsWith('Gagal') ? prev : 'Koneksi terputus dari HP.'));
      setFps(0);
    };
  };

  useEffect(() => {
    if (!session.isDemo) {
      connectWebSocket();
      return () => {
        wsRef.current?.close();
        audioCtxRef.current?.close();
        audioCtxRef.current = null;
      };
    }
  }, [session]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const pad = isFullScreen ? 0 : 24;
      setBoxSize({
        width: Math.max(100, el.clientWidth - pad),
        height: Math.max(100, el.clientHeight - pad),
      });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFullScreen]);

  useEffect(() => {
    if (!isRecording) { setRecSeconds(0); return; }
    const t = setInterval(() => setRecSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isRecording]);

  // Demo simulation animation
  useEffect(() => {
    if (!session.isDemo) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    let raf: number;

    const draw = () => {
      frame++;
      const W = canvas.width, H = canvas.height;
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, `hsl(${220 + Math.sin(frame * 0.01) * 10}, 70%, 15%)`);
      grad.addColorStop(1, `hsl(${260 + Math.cos(frame * 0.01) * 10}, 60%, 10%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, 0, W, 44);
      ctx.fillStyle = 'white';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('DEMO MODE', 14, 28);

      const iconSize = W < 400 ? 46 : 56;
      const cols = Math.max(2, Math.floor(W / (iconSize + 24)));
      const startX = (W - cols * (iconSize + 24) + 24) / 2;
      const colors = ['#EF4444','#F97316','#EAB308','#22C55E','#3B82F6','#8B5CF6','#EC4899','#06B6D4'];
      for (let i = 0; i < 8; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.roundRect(startX + col * (iconSize + 24), 80 + row * (iconSize + 44), iconSize, iconSize, 12);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [session.isDemo, orientation]);

  const toggleRecord = async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    chunksRef.current = [];
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const arrayBuf = await blob.arrayBuffer();
      const api = (window as any).electronAPI;
      if (api?.saveRecording) {
        await api.saveRecording({
          defaultName: `MirrorEuy_${Date.now()}.webm`,
          buffer: new Uint8Array(arrayBuf),
        });
      }
    };
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
  };

  const takeScreenshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `MirrorEuy_Screenshot_${Date.now()}.png`;
    a.click();
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  const latencyColor = latency < 60 ? 'text-green-600' : latency < 110 ? 'text-yellow-600' : 'text-red-600';

  const scale = Math.min(
    boxSize.width / Math.max(1, canvasSize.width),
    boxSize.height / Math.max(1, canvasSize.height)
  );
  const displayWidth = Math.max(1, Math.floor(canvasSize.width * scale));
  const displayHeight = Math.max(1, Math.floor(canvasSize.height * scale));

  return (
    <div className={`flex flex-col h-full ${isFullScreen ? 'bg-black' : 'bg-slate-50'}`}>
      {/* ── Top Info Bar (hidden in fullscreen) ── */}
      {!isFullScreen && (
        <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full ${status === 'live' ? 'bg-green-500 animate-pulse' : status === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-sm font-medium text-slate-700">{session.deviceName}</span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              {session.connectionType === 'USB' ? <Usb className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
              {session.connectionType}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <span className={`flex items-center gap-1 ${latencyColor}`}>
              <Clock className="w-3.5 h-3.5" />
              {latency} ms
            </span>
            <span className="text-slate-400">{fps} FPS</span>
            {isRecording && (
              <span className="flex items-center gap-1 text-red-500 font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                REC {fmt(recSeconds)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Main Area ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div
          ref={containerRef}
          className={`flex-1 min-w-0 min-h-0 overflow-hidden flex items-center justify-center relative ${isFullScreen ? 'p-0 bg-black' : 'p-3 bg-slate-100'}`}
        >
          {/* Floating exit fullscreen button */}
          {isFullScreen && (
            <button
              onClick={onToggleFullScreen}
              className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white/80 hover:text-white text-xs font-medium backdrop-blur-sm border border-white/15 transition-all"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              Keluar Fullscreen (ESC)
            </button>
          )}

          {/* Container preview: ukuran selalu presisi mengikuti aspect ratio HP */}
          <div
            className={`relative flex items-center justify-center bg-black overflow-hidden ${
              isFullScreen
                ? ''
                : 'rounded-2xl shadow-xl border-2 border-slate-800'
            }`}
            style={{
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
            }}
          >
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              onClick={unlockAudio}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                cursor: 'default',
              }}
            />

            {/* Toast unlock audio - muncul sekali saat live & belum diklik */}
            {status === 'live' && !audioUnlocked && !isMuted && (
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-full bg-black/70 backdrop-blur-sm border border-white/20 text-white text-xs font-medium cursor-pointer select-none"
                onClick={unlockAudio}
              >
                <Volume2 className="w-3.5 h-3.5 text-green-400 animate-pulse" />
                Klik layar untuk aktifkan suara
              </div>
            )}

            {status !== 'live' && (
              <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center gap-3">
                <p className="text-sm text-white font-medium">{statusText}</p>
                {status === 'error' && (
                  <button
                    onClick={connectWebSocket}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand-dark transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Coba Hubungkan Lagi
                  </button>
                )}
              </div>
            )}

            {isAnnotating && (
              <div className="absolute inset-0 cursor-crosshair bg-blue-500/5 border-2 border-dashed border-blue-400 pointer-events-none">
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                  Mode Anotasi Aktif
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Controls Panel (hidden in fullscreen) ── */}
        {!isFullScreen && (
          <aside className="w-52 border-l border-slate-100 bg-white flex flex-col p-4 gap-2.5 shrink-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kontrol</p>

            <button
              onClick={onToggleFullScreen}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-brand bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-all"
            >
              <Maximize2 className="w-4 h-4" />
              Layar Penuh
            </button>

            <button
              onClick={toggleRecord}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                isRecording
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              {isRecording ? (
                <><Square className="w-4 h-4 fill-red-500 text-red-500" /> Stop Rekam</>
              ) : (
                <><Circle className="w-4 h-4 text-red-400" /> Mulai Rekam</>
              )}
            </button>

            <button
              onClick={takeScreenshot}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 border border-slate-200 hover:border-slate-300 transition-all"
            >
              <Camera className="w-4 h-4 text-slate-500" />
              Screenshot
            </button>

            <button
              onClick={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 border border-slate-200 hover:border-slate-300 transition-all"
            >
              <RotateCw className="w-4 h-4 text-slate-500" />
              Putar Layar
            </button>

            <button
              onClick={() => setIsAnnotating(a => !a)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                isAnnotating
                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <PenTool className="w-4 h-4" />
              {isAnnotating ? 'Selesai Coret' : 'Coret Layar'}
            </button>

            <button
              onClick={() => setIsMuted(m => !m)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                isMuted
                  ? 'bg-orange-50 border-orange-200 text-orange-600'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {isMuted ? 'Suara Mati' : 'Suara Nyala'}
            </button>

            <div className="mt-auto border-t border-slate-100 pt-3">
              <button
                onClick={onDisconnect}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
              >
                <Power className="w-4 h-4" />
                Putuskan Koneksi
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
