import React, { useRef, useEffect, useState } from 'react';
import { AnnotationStroke, AnnotationPoint } from '../types';

interface ReceiverCanvasProps {
  isGamingMode: boolean;
  orientation: 'landscape' | 'portrait';
  isAnnotating: boolean;
  activeColor: string;
  strokes: AnnotationStroke[];
  onAddStroke: (stroke: AnnotationStroke) => void;
  gameTitle: string;
  fpsTarget: number;
}

export const ReceiverCanvas: React.FC<ReceiverCanvasProps> = ({
  isGamingMode,
  orientation,
  isAnnotating,
  activeColor,
  strokes,
  onAddStroke,
  gameTitle,
  fpsTarget
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<AnnotationPoint[]>([]);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  // Dimensions based on orientation
  const width = orientation === 'landscape' ? 1280 : 576;
  const height = orientation === 'landscape' ? 720 : 1024;

  // Touch / click ripple effect simulation
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isAnnotating) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRipple = { id: Date.now() + Math.random(), x, y };
    setRipples(prev => [...prev.slice(-4), newRipple]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 600);
  };

  // Annotation Drawing handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isAnnotating) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const pt = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
    setIsDrawing(true);
    setCurrentStroke([pt]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isAnnotating || !isDrawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const pt = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
    setCurrentStroke(prev => [...prev, pt]);
  };

  const handleMouseUp = () => {
    if (!isAnnotating || !isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 1) {
      onAddStroke({
        id: 'stroke_' + Date.now(),
        type: 'pen',
        color: activeColor,
        points: currentStroke,
        width: 4
      });
    }
    setCurrentStroke([]);
  };

  // Render Annotations
  useEffect(() => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Render saved strokes
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = 8;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });

    // Render active stroke
    if (currentStroke.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = activeColor;
      ctx.shadowBlur = 10;
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
      }
      ctx.stroke();
    }
  }, [strokes, currentStroke, activeColor, width, height]);

  // Dynamic Esports Simulation Canvas Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let frameCount = 0;

    // Simulation particles & game world
    const particles: { x: number; y: number; vx: number; vy: number; color: string; size: number }[] = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        color: Math.random() > 0.5 ? '#00FFC1' : '#0066FF',
        size: Math.random() * 3 + 1.5
      });
    }

    const render = () => {
      frameCount++;
      ctx.clearRect(0, 0, width, height);

      // Background gradient map (Deep fantasy arena)
      const grad = ctx.createRadialGradient(
        width / 2 + Math.sin(frameCount * 0.02) * 80,
        height / 2 + Math.cos(frameCount * 0.02) * 50,
        100,
        width / 2,
        height / 2,
        width * 0.7
      );
      grad.addColorStop(0, '#101B38');
      grad.addColorStop(0.5, '#0B0F20');
      grad.addColorStop(1, '#05070E');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Arena grid lines
      ctx.strokeStyle = 'rgba(0, 255, 193, 0.07)';
      ctx.lineWidth = 1;
      const gridSize = 60;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Animated Particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Animated Hero / Character avatar simulation (Esports MOBA style)
      const heroX = width / 2 + Math.sin(frameCount * 0.03) * (width * 0.25);
      const heroY = height / 2 + Math.cos(frameCount * 0.04) * (height * 0.15);

      // Skill area indicator aura
      ctx.save();
      ctx.beginPath();
      ctx.arc(heroX, heroY, 65, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 255, 193, 0.12)';
      ctx.fill();
      ctx.strokeStyle = '#00FFC1';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.restore();

      // Hero Body
      ctx.save();
      ctx.shadowColor = '#00FFC1';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#00FFC1';
      ctx.beginPath();
      ctx.arc(heroX, heroY, 22, 0, Math.PI * 2);
      ctx.fill();

      // Hero Health Bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(heroX - 35, heroY - 40, 70, 7);
      ctx.fillStyle = '#00FFC1';
      ctx.fillRect(heroX - 34, heroY - 39, 58, 5);
      ctx.restore();

      // Mobile In-Game HUD Elements (Skill buttons, Minimap, JoyStick)
      // Minimap (Top Left or Top Right)
      const mmX = width - 180;
      const mmY = 20;
      ctx.fillStyle = 'rgba(10, 10, 20, 0.85)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(mmX, mmY, 160, 100);
      ctx.fillRect(mmX, mmY, 160, 100);

      // Minimap dots
      ctx.fillStyle = '#00FFC1';
      ctx.beginPath();
      ctx.arc(mmX + 80 + (heroX / width) * 60, mmY + 50 + (heroY / height) * 30, 4, 0, Math.PI * 2);
      ctx.fill();

      // Virtual Joystick (Bottom Left)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(120, height - 120, 55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(120 + Math.sin(frameCount * 0.05) * 20, height - 120 + Math.cos(frameCount * 0.05) * 20, 25, 0, Math.PI * 2);
      ctx.fill();

      // Virtual Action Buttons (Bottom Right)
      const btnX = width - 120;
      const btnY = height - 100;
      ctx.fillStyle = 'rgba(0, 255, 193, 0.25)';
      ctx.strokeStyle = '#00FFC1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(btnX, btnY, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Skill 1, 2, 3
      [
        { x: btnX - 60, y: btnY - 20 },
        { x: btnX - 50, y: btnY - 80 },
        { x: btnX + 10, y: btnY - 80 },
      ].forEach((btn, idx) => {
        ctx.fillStyle = 'rgba(0, 102, 255, 0.3)';
        ctx.strokeStyle = '#0066FF';
        ctx.beginPath();
        ctx.arc(btn.x, btn.y, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // Subtle Scanlines
      ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
      for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y, width, 1);
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [width, height, fpsTarget]);

  return (
    <div 
      className="relative flex items-center justify-center w-full h-full bg-quantum-950 overflow-hidden cursor-crosshair select-none"
      onClick={handleCanvasClick}
    >
      {/* Phone Screen Container with hardware chassis styling */}
      <div 
        className={`relative transition-all duration-300 shadow-2xl rounded-2xl overflow-hidden border-2 border-quantum-700/80 bg-black ${
          orientation === 'landscape' ? 'aspect-video max-h-[88vh] max-w-[94vw]' : 'aspect-[9/16] max-h-[85vh]'
        }`}
      >
        {/* Dynamic Canvas Video Feed */}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-full block object-contain"
        />

        {/* Live Annotations Canvas Overlay */}
        <canvas
          ref={annotationCanvasRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`absolute inset-0 w-full h-full z-10 ${
            isAnnotating ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
          }`}
        />

        {/* Click / Touch Ripple Feedback */}
        {ripples.map(ripple => (
          <span
            key={ripple.id}
            className="absolute rounded-full border-2 border-plasma bg-plasma/20 pointer-events-none animate-ping transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${ripple.x}px`,
              top: `${ripple.y}px`,
              width: '40px',
              height: '40px',
            }}
          />
        ))}

        {/* Subtle Phone Notch / Camera pinhole indicator */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-16 h-3.5 bg-black/80 rounded-full flex items-center justify-center border border-white/10 pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-slate-900 border border-slate-700"></div>
        </div>
      </div>
    </div>
  );
};
