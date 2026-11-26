export type ConnectionType = 'USB3.0' | 'USB2.0' | 'WiFi6' | 'WiFi5';

export interface Device {
  id: string;
  name: string;
  type: ConnectionType;
  port: string;
  status: 'ready' | 'connecting' | 'connected' | 'unauthorized';
  latencyEst: number; // in ms
  battery: number; // percentage
  ip: string;
  wifiBand: string;
  serial: string;
}

export type CodecMode = 'HEVC' | 'H.264' | 'PNG_LOSSLESS';

export interface TelemetryMetrics {
  latencyMs: number;
  jitterMs: number;
  bitrateMbps: number;
  fps: number;
  droppedFrames: number;
  cpuUsage: number;
  connectionType: ConnectionType;
  networkQuality: 'excellent' | 'good' | 'poor';
}

export interface StreamConfig {
  resolution: '1080p' | '720p' | '1440p';
  framerate: 30 | 60 | 90;
  priorityMode: 'latency' | 'quality' | 'balanced';
  codec: CodecMode;
  autoFailover: boolean;
  batteryOptimization: boolean;
}

export interface ObsProfile {
  connected: boolean;
  port: number;
  currentScene: string;
  scenes: string[];
}

export interface ChatMessage {
  id: string;
  user: string;
  badge?: string;
  message: string;
  timestamp: string;
  color?: string;
}

export interface Participant {
  id: string;
  name: string;
  role: 'owner' | 'co-streamer' | 'viewer';
  canAnnotate: boolean;
  avatar: string;
}

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface AnnotationStroke {
  id: string;
  type: 'pen' | 'arrow' | 'rect';
  color: string;
  points: AnnotationPoint[];
  width: number;
}
