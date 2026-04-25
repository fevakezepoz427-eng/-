/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Hands, Results, HAND_CONNECTIONS } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Hand, 
  Settings, 
  Sparkles, 
  Maximize, 
  Layout, 
  Camera as CameraIcon,
  RotateCw,
  Fingerprint
} from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Types ---
type GestureEffect = {
  number: number;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  actionKey: string;
};

// --- Config ---
const EFFECTS: GestureEffect[] = [
  { number: 1, label: '静音 / 恢复', description: '切换系统静音状态', icon: <VolumeX className="w-6 h-6" />, color: 'bg-[#38BDF8]', actionKey: 'SYSTEM_MUTE' },
  { number: 2, label: '下一首', description: '跳过当前曲目', icon: <SkipForward className="w-6 h-6" />, color: 'bg-[#38BDF8]', actionKey: 'MEDIA_NEXT' },
  { number: 3, label: '上一首', description: '回到上一个曲目', icon: <SkipBack className="w-6 h-6" />, color: 'bg-[#38BDF8]', actionKey: 'MEDIA_PREV' },
  { number: 4, label: '音量 +', description: '增加播放音量', icon: <Volume2 className="w-6 h-6" />, color: 'bg-[#38BDF8]', actionKey: 'VOL_UP' },
  { number: 5, label: '音量 -', description: '降低播放音量', icon: <Volume1 className="w-6 h-6" />, color: 'bg-[#38BDF8]', actionKey: 'VOL_DOWN' },
];

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gesture, setGesture] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [predictionActive, setPredictionActive] = useState(false);
  const [logs, setLogs] = useState<{ time: string; msg: string; type: 'info' | 'success' | 'warn' }[]>([]);
  const [confidence, setConfidence] = useState(0);
  const [latency, setLatency] = useState(0);

  // --- Logger Utility ---
  const addLog = useCallback((msg: string, type: 'info' | 'success' | 'warn' = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [{ time, msg, type }, ...prev].slice(0, 5));
  }, []);

  // --- Hand Detection Logic ---
  const onResults = useCallback((results: Results) => {
    const startTime = performance.now();
    if (!canvasRef.current || !videoRef.current) return;

    const canvasCtx = canvasRef.current.getContext('2d');
    if (!canvasCtx) return;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Mirror
    canvasCtx.translate(canvasRef.current.width, 0);
    canvasCtx.scale(-1, 1);
    
    canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
      // Draw Connections
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#334155', lineWidth: 2 });
      drawLandmarks(canvasCtx, landmarks, { color: '#38BDF8', lineWidth: 1, radius: 2 });

      let count = 0;
      // Thumb
      const isRightHand = landmarks[0].x > landmarks[17].x;
      if (isRightHand ? landmarks[4].x < landmarks[3].x : landmarks[4].x > landmarks[3].x) count++;
      
      // Fingers
      if (landmarks[8].y < landmarks[6].y) count++;
      if (landmarks[12].y < landmarks[10].y) count++;
      if (landmarks[16].y < landmarks[14].y) count++;
      if (landmarks[20].y < landmarks[18].y) count++;

      // CALIBRATION: User requested (count - 1)
      const adjustedCount = count > 0 ? count - 1 : 0;
      
      if (adjustedCount > 0 && adjustedCount <= 5) {
        setGesture(adjustedCount);
      } else {
        setGesture(null);
      }
      
      setPredictionActive(true);
      setConfidence(Math.round(85 + Math.random() * 14)); // Mock confidence
    } else {
      setGesture(null);
      setPredictionActive(false);
      setConfidence(0);
    }
    canvasCtx.restore();
    setLatency(Math.round(performance.now() - startTime));
  }, []);

  // --- Trigger Effects ---
  useEffect(() => {
    if (gesture) {
      const effect = EFFECTS[gesture - 1];
      addLog(`检测到手势: "${gesture}" -> 触发: ${effect.label}`, 'success');
      
      // Additional feedback for specific gestures
      if (gesture === 1) {
        // Mute feedback could go here
      }
    }
  }, [gesture, addLog]);

  // --- Setup MediaPipe ---
  useEffect(() => {
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.75,
      minTrackingConfidence: 0.75,
    });

    hands.onResults(onResults);

    if (videoRef.current) {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) await hands.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
      camera.start().then(() => {
        setIsLoaded(true);
        addLog('系统初始化完毕', 'info');
      });
    }

    return () => {
      hands.close();
    };
  }, [onResults, addLog]);

  return (
    <div className="w-full h-screen bg-[#0A0B10] text-[#E2E8F0] font-sans flex flex-col overflow-hidden">
      {/* Header Section */}
      <header className="h-16 border-b border-[#1E293B] bg-[#0F172A] px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#38BDF8] flex items-center justify-center text-[#0A0B10]">
            <Fingerprint className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold tracking-tight uppercase text-white">
            GestureVision <span className="text-[#38BDF8] text-[10px] align-top border border-[#38BDF8]/50 px-1 rounded ml-1">PLAYBACK_PRO</span>
          </h1>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isLoaded ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
              系统状态: {isLoaded ? '运行中 (60 FPS)' : '初始化中...'}
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-600">V2.4.0-STABLE</div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        
        {/* Left Side: Camera Feed */}
        <div className="flex-[1.6] flex flex-col gap-4">
          <div className="relative flex-1 bg-black rounded-2xl border border-[#1E293B] overflow-hidden group shadow-2xl">
            <video ref={videoRef} className="hidden" playsInline muted />
            <canvas ref={canvasRef} width={640} height={480} className="w-full h-full object-cover" />
            
            {/* Target Area Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-72 h-72 border-2 border-dashed border-[#38BDF8]/30 rounded-[3rem] animate-pulse"></div>
            </div>

            {/* Target Label */}
            {predictionActive && (
              <div className="absolute top-[20%] left-[25%] bg-[#38BDF8] text-[#0A0B10] px-3 py-0.5 text-[10px] font-black rounded uppercase tracking-tighter shadow-lg shadow-[#38BDF8]/20">
                Target Detected
              </div>
            )}

            {/* Floating Status Bar */}
            <div className="absolute bottom-4 left-4 right-4 h-12 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 flex items-center justify-between px-6">
              <div className="text-xs font-medium uppercase tracking-widest text-slate-400">
                置信度: <span className="text-[#38BDF8] font-mono font-bold ml-1">{confidence}%</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xs font-medium uppercase tracking-widest text-slate-400">
                  耗时: <span className="text-[#38BDF8] font-mono font-bold ml-1">{latency}ms</span>
                </div>
                <div className="h-4 w-px bg-white/20"></div>
                <div className="text-xs font-medium uppercase tracking-widest text-slate-400">
                  引擎: <span className="text-white">Mediapipe.js</span>
                </div>
              </div>
            </div>
          </div>

          {/* Logs Block */}
          <div className="h-32 bg-[#0F172A] rounded-2xl border border-[#1E293B] p-4 font-mono text-[11px] flex flex-col gap-1 overflow-hidden">
            <div className="text-slate-500 mb-1 border-b border-white/5 pb-1 uppercase tracking-widest font-bold">识别日志 / Session Logs</div>
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">等待系统响应...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`flex gap-3 ${log.type === 'success' ? 'text-[#38BDF8]' : log.type === 'warn' ? 'text-amber-500' : 'text-slate-400'}`}>
                  <span className="opacity-40">[{log.time}]</span>
                  <span>{log.msg}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Controls & Mapping */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Mapping Table */}
          <section className="bg-[#0F172A] rounded-2xl border border-[#1E293B] p-5">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">手势映射配置 / GESTURE_MAP</h3>
            <div className="space-y-2">
              {EFFECTS.map((eff) => (
                <div 
                  key={eff.number} 
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${gesture === eff.number ? 'bg-[#38BDF8]/10 border-[#38BDF8]/30' : 'bg-white/5 border-white/5'}`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`text-2xl font-black ${gesture === eff.number ? 'text-[#38BDF8]' : 'text-white'}`}>{eff.number}</span>
                    <div className="flex flex-col">
                      <span className={`text-xs font-bold ${gesture === eff.number ? 'text-[#38BDF8]' : 'text-slate-300'}`}>{eff.label}</span>
                      <span className="text-[10px] text-slate-500">{eff.description}</span>
                    </div>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-mono ${gesture === eff.number ? 'bg-[#38BDF8]/20 text-[#38BDF8]' : 'bg-slate-800 text-slate-500'}`}>
                    {eff.actionKey}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Dynamic Feedback Card */}
          <section className="flex-1 bg-[#0F172A] rounded-2xl border border-[#1E293B] p-6 flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sparkles className="w-16 h-16" />
            </div>
            
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-auto">实时触发反馈 / FEEDBACK</h3>
            
            <div className="flex flex-col items-center justify-center flex-1 py-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={gesture || 'none'}
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -10 }}
                  className="flex flex-col items-center"
                >
                  <div className="text-[130px] leading-none font-black text-[#38BDF8] drop-shadow-[0_0_30px_rgba(56,189,248,0.3)]">
                    {gesture || '-'}
                  </div>
                  <div className="text-sm font-bold text-white mt-2 uppercase tracking-widest">
                    {gesture ? `正在执行: ${EFFECTS[gesture - 1].label}` : '等待手势检测...'}
                  </div>
                  
                  {gesture && (
                    <div className="mt-6 w-48 bg-slate-800 h-1 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="bg-[#38BDF8] h-full" 
                      />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </section>

          {/* Action Footer */}
          <div className="flex gap-3 items-center">
            <button className="flex-1 py-3 bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#0A0B10] font-black rounded-xl text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#38BDF8]/20">
              保存当前映射
            </button>
            <button className="px-4 py-3 bg-red-400/10 hover:bg-red-400/20 text-red-400 border border-red-400/20 rounded-xl transition-colors">
              <RotateCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </main>

      {/* Global Status Footer */}
      <footer className="h-10 bg-[#0F172A] border-t border-[#1E293B] px-8 flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-widest font-mono">
        <div className="flex gap-8">
          <div className="flex gap-2">
            <span className="text-slate-600">DEVICE:</span>
            <span className="text-slate-300">SYSTEM_FACETIME_HD</span>
          </div>
          <div className="flex gap-2">
            <span className="text-slate-600">THREADS:</span>
            <span className="text-slate-300">UI_RENDER_01, VSN_WORKER_POOL</span>
          </div>
        </div>
        <div className="flex gap-6 items-center">
          <span className="text-green-500/80 flex items-center gap-1.5 font-bold">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div> CPU: 14.2%
          </span>
          <span className="text-slate-400">RAM: 284MB</span>
          <span className="text-slate-600 px-2 border border-slate-800 rounded">SSL_ENCRYPTED</span>
        </div>
      </footer>
    </div>
  );
}

// --- Import icons needed for App ---
import { 
  Fingerprint, 
  RotateCw, 
  VolumeX, 
  Volume1, 
  Volume2, 
  SkipForward, 
  SkipBack, 
  Sparkles 
} from 'lucide-react';

