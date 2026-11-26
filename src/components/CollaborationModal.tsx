import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Users, 
  Shield, 
  Edit3, 
  Eye, 
  UserPlus,
  AlertCircle
} from 'lucide-react';
import { Participant } from '../types';

interface CollaborationModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
}

export const CollaborationModal: React.FC<CollaborationModalProps> = ({
  isOpen,
  onClose,
  roomCode
}) => {
  const [copied, setCopied] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: 'p1',
      name: 'Andi "GusionMain" (Host)',
      role: 'owner',
      canAnnotate: true,
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=andi'
    },
    {
      id: 'p2',
      name: 'Coach_Rizal (Co-Streamer)',
      role: 'co-streamer',
      canAnnotate: true,
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=rizal'
    },
    {
      id: 'p3',
      name: 'Sarah_Educator',
      role: 'viewer',
      canAnnotate: false,
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=sarah'
    }
  ]);

  if (!isOpen) return null;

  const shareUrl = `https://mirror-euy.live/collab/${roomCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleAnnotate = (id: string) => {
    setParticipants(prev =>
      prev.map(p => (p.id === id ? { ...p, canAnnotate: !p.canAnnotate } : p))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-quantum-900 border border-quantum-700 rounded-2xl shadow-2xl p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-quantum-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2.5 rounded-xl bg-plasma-dim text-plasma border border-plasma/30">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-rajdhani font-bold uppercase tracking-wider text-white">
              Sesi Kolaborasi Real-Time
            </h2>
            <p className="text-xs text-slate-400">
              Bagikan layar interaktif dengan maksimal 5 peserta co-host
            </p>
          </div>
        </div>

        {/* Share Link Input */}
        <div className="mb-5">
          <label className="block text-xs font-mono text-slate-400 mb-1.5 font-semibold">
            TAUTAN KOLABORASI
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-quantum-950 border border-quantum-700 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 select-all focus:outline-none focus:border-plasma"
            />
            <button
              onClick={copyToClipboard}
              className={`px-3 py-2.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-1.5 ${
                copied
                  ? 'bg-plasma text-quantum-950'
                  : 'bg-quantum-800 hover:bg-quantum-700 text-white border border-quantum-600'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>
        </div>

        {/* Participant List */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 font-semibold uppercase">
              Peserta Aktif ({participants.length}/5)
            </span>
            <span className="text-[11px] font-mono text-plasma">Slot Tersedia: {5 - participants.length}</span>
          </div>

          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {participants.map(p => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-quantum-850 border border-quantum-800 text-xs font-mono"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-quantum-700 flex items-center justify-center text-plasma font-bold">
                    {p.name[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      <span>{p.name}</span>
                      {p.role === 'owner' && (
                        <Shield className="w-3 h-3 text-plasma" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase">{p.role}</span>
                  </div>
                </div>

                {p.role !== 'owner' && (
                  <button
                    onClick={() => toggleAnnotate(p.id)}
                    className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 border transition-colors ${
                      p.canAnnotate
                        ? 'bg-plasma-dim text-plasma border-plasma/40'
                        : 'bg-quantum-800 text-slate-400 border-quantum-700 hover:text-white'
                    }`}
                    title={p.canAnnotate ? 'Cabut izin coret' : 'Beri izin coret'}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{p.canAnnotate ? 'Bisa Coret' : 'Lihat Saja'}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quota Rules Alert */}
        <div className="p-3 rounded-xl bg-quantum-850/60 border border-quantum-800 text-slate-400 text-[11px] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-plasma shrink-0 mt-0.5" />
          <span>
            Sesuai batas SRS 1.3: Pemilik layar memiliki kendali mutlak dan dapat mencabut akses interaksi kapan saja.
          </span>
        </div>
      </div>
    </div>
  );
};
