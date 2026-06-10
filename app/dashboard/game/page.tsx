'use client';

import React, { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, RotateCcw, Volume2, VolumeX, Award, Trophy, Info, Sparkles, Target, Zap, HelpCircle, Activity } from 'lucide-react';

interface Entity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  color: string;
  label?: string;
}

// ----------------------------------------------------
// 1. GAME 1: FUTEBOL DE BOTÃO (BUTTON FOOTBALL) COMPONENT
// ----------------------------------------------------
function ButtonFootballGame({ soundEnabled, playSound }: { soundEnabled: boolean; playSound: Function }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [highScore, setHighScore] = useState(0);
  const [turn, setTurn] = useState<'player' | 'ai' | 'animating'>('player');
  const [gameMessage, setGameMessage] = useState<string | null>('Sua Vez! Arraste um botão azul.');
  const [gameActive, setGameActive] = useState(true);
  const [winner, setWinner] = useState<'player' | 'ai' | null>(null);

  const PITCH_WIDTH = 900;
  const PITCH_HEIGHT = 550;
  const GOAL_SIZE = 120;
  const GOAL_DEPTH = 30;
  const FRICTION = 0.985;
  const BALL_BOUNCE = 0.8;
  const BUTTON_BOUNCE = 0.6;
  const WALL_BOUNCE = 0.7;

  const gameStateRef = useRef<{
    ball: Entity;
    playerTeam: Entity[];
    aiTeam: Entity[];
    selectedButton: Entity | null;
    dragStart: { x: number; y: number } | null;
    dragCurrent: { x: number; y: number } | null;
    lastShooter: 'player' | 'ai' | null;
    confettiParticles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      size: number;
      rotation: number;
      rotationSpeed: number;
      opacity: number;
    }>;
  }>({
    ball: { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2, vx: 0, vy: 0, radius: 12, mass: 1, color: '#FFFFFF' },
    playerTeam: [
      { x: 280, y: 180, vx: 0, vy: 0, radius: 24, mass: 4, color: '#3B82F6', label: '10' },
      { x: 280, y: 370, vx: 0, vy: 0, radius: 24, mass: 4, color: '#3B82F6', label: '9' },
      { x: 80, y: PITCH_HEIGHT / 2, vx: 0, vy: 0, radius: 24, mass: 4, color: '#10B981', label: '1' }, // Goalkeeper
    ],
    aiTeam: [
      { x: 620, y: 180, vx: 0, vy: 0, radius: 24, mass: 4, color: '#EF4444', label: '7' },
      { x: 620, y: 370, vx: 0, vy: 0, radius: 24, mass: 4, color: '#EF4444', label: '11' },
      { x: 820, y: PITCH_HEIGHT / 2, vx: 0, vy: 0, radius: 24, mass: 4, color: '#F59E0B', label: '1' }, // Goalkeeper
    ],
    selectedButton: null,
    dragStart: null,
    dragCurrent: null,
    lastShooter: null,
    confettiParticles: []
  });

  useEffect(() => {
    const saved = localStorage.getItem('button_football_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
    playSound('whistle');
  }, []);

  const resetPositions = (isGoal = false) => {
    const state = gameStateRef.current;
    state.ball.x = PITCH_WIDTH / 2;
    state.ball.y = PITCH_HEIGHT / 2;
    state.ball.vx = 0;
    state.ball.vy = 0;

    state.playerTeam[0].x = 280;
    state.playerTeam[0].y = 180;
    state.playerTeam[1].x = 280;
    state.playerTeam[1].y = 370;
    state.playerTeam[2].x = 80;
    state.playerTeam[2].y = PITCH_HEIGHT / 2;

    state.aiTeam[0].x = 620;
    state.aiTeam[0].y = 180;
    state.aiTeam[1].x = 620;
    state.aiTeam[1].y = 370;
    state.aiTeam[2].x = 820;
    state.aiTeam[2].y = PITCH_HEIGHT / 2;

    [...state.playerTeam, ...state.aiTeam].forEach(btn => {
      btn.vx = 0;
      btn.vy = 0;
    });

    state.selectedButton = null;
    state.dragStart = null;
    state.dragCurrent = null;

    if (!isGoal) {
      setTurn('player');
      setGameMessage('Novo jogo iniciado! Sua Vez.');
      playSound('whistle');
    }
  };

  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updatePhysics = () => {
      if (!gameActive) return;
      const state = gameStateRef.current;
      const entities = [state.ball, ...state.playerTeam, ...state.aiTeam];

      entities.forEach(entity => {
        entity.x += entity.vx;
        entity.y += entity.vy;
        entity.vx *= FRICTION;
        entity.vy *= FRICTION;

        const speed = Math.sqrt(entity.vx * entity.vx + entity.vy * entity.vy);
        if (speed < 0.15) {
          entity.vx = 0;
          entity.vy = 0;
        }
      });

      entities.forEach(entity => {
        const isBall = entity === state.ball;
        const bounce = isBall ? BALL_BOUNCE : WALL_BOUNCE;
        const inGoalY = entity.y >= (PITCH_HEIGHT - GOAL_SIZE) / 2 && entity.y <= (PITCH_HEIGHT + GOAL_SIZE) / 2;

        if (inGoalY) {
          if (entity.x - entity.radius < GOAL_DEPTH) {
            entity.x = GOAL_DEPTH + entity.radius;
            entity.vx = -entity.vx * bounce;
          } else if (entity.x + entity.radius > PITCH_WIDTH - GOAL_DEPTH) {
            entity.x = PITCH_WIDTH - GOAL_DEPTH - entity.radius;
            entity.vx = -entity.vx * bounce;
          }

          if (entity.y - entity.radius < (PITCH_HEIGHT - GOAL_SIZE) / 2) {
            entity.y = (PITCH_HEIGHT - GOAL_SIZE) / 2 + entity.radius;
            entity.vy = -entity.vy * bounce;
          } else if (entity.y + entity.radius > (PITCH_HEIGHT + GOAL_SIZE) / 2) {
            entity.y = (PITCH_HEIGHT + GOAL_SIZE) / 2 - entity.radius;
            entity.vy = -entity.vy * bounce;
          }
        } else {
          if (entity.x - entity.radius < GOAL_DEPTH) {
            entity.x = GOAL_DEPTH + entity.radius;
            entity.vx = -entity.vx * bounce;
            if (Math.abs(entity.vx) > 0.5) playSound('hit');
          } else if (entity.x + entity.radius > PITCH_WIDTH - GOAL_DEPTH) {
            entity.x = PITCH_WIDTH - GOAL_DEPTH - entity.radius;
            entity.vx = -entity.vx * bounce;
            if (Math.abs(entity.vx) > 0.5) playSound('hit');
          }
        }

        if (entity.y - entity.radius < GOAL_DEPTH) {
          entity.y = GOAL_DEPTH + entity.radius;
          entity.vy = -entity.vy * bounce;
          if (Math.abs(entity.vy) > 0.5) playSound('hit');
        } else if (entity.y + entity.radius > PITCH_HEIGHT - GOAL_DEPTH) {
          entity.y = PITCH_HEIGHT - GOAL_DEPTH - entity.radius;
          entity.vy = -entity.vy * bounce;
          if (Math.abs(entity.vy) > 0.5) playSound('hit');
        }
      });

      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const e1 = entities[i];
          const e2 = entities[j];
          const dx = e2.x - e1.x;
          const dy = e2.y - e1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDist = e1.radius + e2.radius;

          if (distance < minDist) {
            const overlap = minDist - distance;
            const nx = dx / distance;
            const ny = dy / distance;
            const totalMass = e1.mass + e2.mass;

            e1.x -= nx * overlap * (e2.mass / totalMass);
            e1.y -= ny * overlap * (e2.mass / totalMass);
            e2.x += nx * overlap * (e1.mass / totalMass);
            e2.y += ny * overlap * (e1.mass / totalMass);

            const kx = e1.vx - e2.vx;
            const ky = e1.vy - e2.vy;
            const vn = kx * nx + ky * ny;

            if (vn > 0) {
              const impulse = (2 * vn) / totalMass;
              const isBallInvolved = e1 === state.ball || e2 === state.ball;
              const elasticity = isBallInvolved ? BALL_BOUNCE : BUTTON_BOUNCE;

              e1.vx -= nx * impulse * e2.mass * elasticity;
              e1.vy -= ny * impulse * e2.mass * elasticity;
              e2.vx += nx * impulse * e1.mass * elasticity;
              e2.vy += ny * impulse * e1.mass * elasticity;

              if (impulse > 0.1) playSound('hit');
            }
          }
        }
      }

      const ball = state.ball;
      if (ball.x - ball.radius <= GOAL_DEPTH) {
        handleGoal('ai');
      } else if (ball.x + ball.radius >= PITCH_WIDTH - GOAL_DEPTH) {
        handleGoal('player');
      }

      if (state.confettiParticles && state.confettiParticles.length > 0) {
        state.confettiParticles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.25;
          p.vx *= 0.98;
          p.rotation += p.rotationSpeed;
          p.opacity -= 0.015;
        });
        state.confettiParticles = state.confettiParticles.filter(p => p.opacity > 0);
      }

      const isAnythingMoving = entities.some(e => Math.abs(e.vx) > 0.1 || Math.abs(e.vy) > 0.1);

      if (turn === 'animating' && !isAnythingMoving) {
        if (state.lastShooter === 'player') {
          setTurn('ai');
          setGameMessage('Adversário pensando...');
        } else {
          setTurn('player');
          setGameMessage('Sua Vez! Arraste um botão.');
        }
      }
    };

    const handleGoal = (scorer: 'player' | 'ai') => {
      if (!gameActive) return;
      const state = gameStateRef.current;
      setGameActive(false);
      playSound('cheer');

      state.confettiParticles = [];
      const colors = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#EC4899', '#8B5CF6'];
      for (let i = 0; i < 80; i++) {
        state.confettiParticles.push({
          x: scorer === 'player' ? PITCH_WIDTH - GOAL_DEPTH : GOAL_DEPTH,
          y: PITCH_HEIGHT / 2 + (Math.random() - 0.5) * 80,
          vx: (scorer === 'player' ? -1 : 1) * (4 + Math.random() * 8) + (Math.random() - 0.5) * 4,
          vy: -6 - Math.random() * 10,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 6 + Math.random() * 6,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.2,
          opacity: 1
        });
      }

      setScore(prev => {
        const next = { ...prev };
        next[scorer] += 1;

        if (scorer === 'player' && next.player > highScore) {
          setHighScore(next.player);
          localStorage.setItem('button_football_highscore', String(next.player));
        }

        if (next[scorer] >= 3) {
          setWinner(scorer);
          setGameMessage(scorer === 'player' ? '🏆 PARABÉNS! VOCÊ VENCEU A PARTIDA!' : '❌ Fim de Jogo. O adversário venceu.');
        } else {
          setGameMessage(scorer === 'player' ? '⚽ GOOOOL DO BRASIL!' : '⚽ Gol do adversário...');
          setTimeout(() => {
            resetPositions(true);
            setGameActive(true);
          }, 3000);
        }
        return next;
      });
    };

    const drawPitch = () => {
      ctx.clearRect(0, 0, PITCH_WIDTH, PITCH_HEIGHT);
      const fieldGrad = ctx.createLinearGradient(0, 0, 0, PITCH_HEIGHT);
      fieldGrad.addColorStop(0, '#14532D');
      fieldGrad.addColorStop(1, '#064E3B');
      ctx.fillStyle = fieldGrad;
      ctx.fillRect(0, 0, PITCH_WIDTH, PITCH_HEIGHT);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      const stripeWidth = PITCH_WIDTH / 15;
      for (let i = 0; i < 15; i += 2) {
        ctx.fillRect(i * stripeWidth, 0, stripeWidth, PITCH_HEIGHT);
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 4;
      ctx.strokeRect(GOAL_DEPTH, GOAL_DEPTH, PITCH_WIDTH - GOAL_DEPTH * 2, PITCH_HEIGHT - GOAL_DEPTH * 2);

      ctx.beginPath();
      ctx.moveTo(PITCH_WIDTH / 2, GOAL_DEPTH);
      ctx.lineTo(PITCH_WIDTH / 2, PITCH_HEIGHT - GOAL_DEPTH);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(PITCH_WIDTH / 2, PITCH_HEIGHT / 2, 80, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeRect(GOAL_DEPTH, (PITCH_HEIGHT - 280) / 2, 160, 280);
      ctx.strokeRect(PITCH_WIDTH - GOAL_DEPTH - 160, (PITCH_HEIGHT - 280) / 2, 160, 280);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.fillRect(0, (PITCH_HEIGHT - GOAL_SIZE) / 2, GOAL_DEPTH, GOAL_SIZE);
      ctx.strokeRect(0, (PITCH_HEIGHT - GOAL_SIZE) / 2, GOAL_DEPTH, GOAL_SIZE);

      ctx.fillRect(PITCH_WIDTH - GOAL_DEPTH, (PITCH_HEIGHT - GOAL_SIZE) / 2, GOAL_DEPTH, GOAL_SIZE);
      ctx.strokeRect(PITCH_WIDTH - GOAL_DEPTH, (PITCH_HEIGHT - GOAL_SIZE) / 2, GOAL_DEPTH, GOAL_SIZE);

      const state = gameStateRef.current;

      if (state.selectedButton && state.dragStart && state.dragCurrent) {
        const dx = state.dragStart.x - state.dragCurrent.x;
        const dy = state.dragStart.y - state.dragCurrent.y;
        ctx.beginPath();
        ctx.strokeStyle = '#22C55E';
        ctx.lineWidth = 4;
        ctx.setLineDash([6, 6]);
        ctx.moveTo(state.selectedButton.x, state.selectedButton.y);
        ctx.lineTo(state.selectedButton.x + dx * 1.5, state.selectedButton.y + dy * 1.5);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
        ctx.arc(state.selectedButton.x + dx * 1.5, state.selectedButton.y + dy * 1.5, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      const drawButton = (btn: Entity, shadowColor: string) => {
        ctx.beginPath();
        ctx.arc(btn.x, btn.y, btn.radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = shadowColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(btn.x, btn.y, btn.radius, 0, Math.PI * 2);
        ctx.fillStyle = btn.color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(btn.x, btn.y, btn.radius * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (btn.label) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(btn.label, btn.x, btn.y);
        }
      };

      state.playerTeam.forEach(btn => drawButton(btn, 'rgba(59, 130, 246, 0.2)'));
      state.aiTeam.forEach(btn => drawButton(btn, 'rgba(239, 68, 68, 0.2)'));

      ctx.beginPath();
      ctx.arc(state.ball.x + 3, state.ball.y + 3, state.ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(state.ball.x, state.ball.y, state.ball.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();

      if (state.confettiParticles && state.confettiParticles.length > 0) {
        state.confettiParticles.forEach(p => {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        });
        ctx.globalAlpha = 1.0;
      }
    };

    const loop = () => {
      updatePhysics();
      drawPitch();
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [turn, gameActive, score, winner]);

  useEffect(() => {
    if (turn !== 'ai' || !gameActive || winner) return;

    const timer = window.setTimeout(() => {
      const state = gameStateRef.current;
      let bestBtn = state.aiTeam[0];
      let minDist = Infinity;

      state.aiTeam.forEach(btn => {
        const dx = state.ball.x - btn.x;
        const dy = state.ball.y - btn.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          bestBtn = btn;
        }
      });

      const dx = state.ball.x - bestBtn.x;
      const dy = state.ball.y - bestBtn.y;
      const angle = Math.atan2(dy, dx);
      const basePower = 15 + Math.random() * 8;
      bestBtn.vx = Math.cos(angle) * basePower;
      bestBtn.vy = Math.sin(angle) * basePower;
      state.lastShooter = 'ai';

      playSound('kick');
      setTurn('animating');
      setGameMessage('Adversário realizou um chute!');
    }, 1800);

    return () => clearTimeout(timer);
  }, [turn, gameActive, winner]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: ((clientX - rect.left) / rect.width) * PITCH_WIDTH,
      y: ((clientY - rect.top) / rect.height) * PITCH_HEIGHT
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (turn !== 'player' || !gameActive || winner) return;
    const pos = getMousePos(e);
    const state = gameStateRef.current;

    const clickedBtn = state.playerTeam.find(btn => {
      const dx = btn.x - pos.x;
      const dy = btn.y - pos.y;
      return Math.sqrt(dx * dx + dy * dy) <= btn.radius + 8;
    });

    if (clickedBtn) {
      state.selectedButton = clickedBtn;
      state.dragStart = pos;
      state.dragCurrent = pos;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const state = gameStateRef.current;
    if (!state.selectedButton || !state.dragStart) return;
    state.dragCurrent = getMousePos(e);
  };

  const handleMouseUp = () => {
    const state = gameStateRef.current;
    if (!state.selectedButton || !state.dragStart || !state.dragCurrent) return;

    const dx = state.dragStart.x - state.dragCurrent.x;
    const dy = state.dragStart.y - state.dragCurrent.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxPower = 25;
    const powerScale = Math.min(distance / 8, maxPower);
    const angle = Math.atan2(dy, dx);

    state.selectedButton.vx = Math.cos(angle) * powerScale;
    state.selectedButton.vy = Math.sin(angle) * powerScale;
    state.lastShooter = 'player';

    playSound('kick');

    state.selectedButton = null;
    state.dragStart = null;
    state.dragCurrent = null;

    setTurn('animating');
    setGameMessage('Bola rolando...');
  };

  const startNewGame = () => {
    setScore({ player: 0, ai: 0 });
    setWinner(null);
    setGameActive(true);
    resetPositions();
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className="w-full max-w-4xl bg-slate-900/60 border border-slate-800 rounded-3xl p-4 md:p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden backdrop-blur-md">
        <div className="flex items-center gap-6 z-10">
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-lg">
              BR
            </div>
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1 block">Brasil</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-3xl md:text-4xl font-black font-display text-white">{score.player}</span>
            <span className="text-slate-600 font-bold text-xl">:</span>
            <span className="text-3xl md:text-4xl font-black font-display text-white">{score.ai}</span>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 font-black text-lg">
              AR
            </div>
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1 block">Argentina</span>
          </div>
        </div>

        <div className="text-center z-10">
          <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Status do Jogo</div>
          <div className={`text-sm font-bold uppercase tracking-tight py-1 px-4 rounded-xl border ${
            turn === 'player' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
              : turn === 'ai' 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {gameMessage}
          </div>
        </div>

        <div className="flex items-center gap-3 z-10">
          <div className="hidden sm:flex items-center gap-2 bg-slate-950/40 px-3.5 py-2 rounded-xl border border-slate-800">
            <Trophy size={16} className="text-amber-500" />
            <span className="text-xs text-slate-400 font-semibold">
              Recorde: <strong className="text-white">{highScore}</strong>
            </span>
          </div>

          <button 
            onClick={startNewGame}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black text-xs uppercase tracking-wider transition-all active:scale-95"
          >
            <RotateCcw size={14} />
            Reiniciar
          </button>
        </div>
      </div>

      <div className="w-full max-w-4xl bg-slate-950 rounded-[36px] p-4 border border-slate-800 shadow-2xl relative">
        <AnimatePresence>
          {winner && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 rounded-[32px] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="max-w-md">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-6">
                  <Award size={48} />
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tighter mb-2 text-white">
                  {winner === 'player' ? 'Vitória do Brasil!' : 'Vitória da Argentina!'}
                </h2>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                  {winner === 'player' ? 'Parabéns, você deu um show na física!' : 'A IA venceu. Treine a mira e tente de novo!'}
                </p>
                <button
                  onClick={startNewGame}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95"
                >
                  Jogar Novamente
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <canvas
          ref={canvasRef}
          width={PITCH_WIDTH}
          height={PITCH_HEIGHT}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          className="w-full aspect-[900/550] bg-emerald-950 rounded-[28px] border border-emerald-900/80 cursor-crosshair select-none touch-none"
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 2. GAME 2: EMBAIXADINHAS (KEEPIE UPPIE) COMPONENT
// ----------------------------------------------------
function KeepieUppieGame({ soundEnabled, playSound }: { soundEnabled: boolean; playSound: Function }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [gameMessage, setGameMessage] = useState('Clique na bola para iniciar o jogo!');

  const WIDTH = 900;
  const HEIGHT = 550;
  const GRAVITY = 0.35;
  const BOUNCE_X_FACTOR = 0.35;

  const ballRef = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    rotation: number;
    rotationSpeed: number;
  }>({
    x: WIDTH / 2,
    y: 180,
    vx: 0,
    vy: 0,
    radius: 30,
    rotation: 0,
    rotationSpeed: 0
  });

  const sparksRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    opacity: number;
  }>>([]);

  useEffect(() => {
    const saved = localStorage.getItem('embaixadinhas_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const spawnSparks = (x: number, y: number) => {
    const colors = ['#F59E0B', '#10B981', '#3B82F6', '#FFFFFF', '#A855F7'];
    for (let i = 0; i < 15; i++) {
      sparksRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 4,
        opacity: 1
      });
    }
  };

  const startGame = () => {
    const ball = ballRef.current;
    ball.x = WIDTH / 2;
    ball.y = 120;
    ball.vx = (Math.random() - 0.5) * 4;
    ball.vy = -2;
    ball.rotation = 0;
    ball.rotationSpeed = 0.05;
    
    setCombo(0);
    setGameActive(true);
    setGameMessage('Mantenha a bola no ar!');
    playSound('whistle');
  };

  const handleKick = (clickX: number, clickY: number) => {
    const ball = ballRef.current;
    const dx = ball.x - clickX;
    const dy = ball.y - clickY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < ball.radius + 25) {
      if (!gameActive) {
        startGame();
        return;
      }

      ball.vy = -10 - Math.random() * 2;
      ball.vx = dx * BOUNCE_X_FACTOR;
      ball.rotationSpeed = (dx / ball.radius) * 0.2;

      spawnSparks(clickX, clickY);
      playSound('kick');

      setCombo(prev => {
        const next = prev + 1;
        if (next > highScore) {
          setHighScore(next);
          localStorage.setItem('embaixadinhas_highscore', String(next));
        }

        if (next % 10 === 0) {
          playSound('cheer');
          spawnSparks(WIDTH / 2, HEIGHT / 2);
          spawnSparks(WIDTH / 2 - 100, HEIGHT / 2);
          spawnSparks(WIDTH / 2 + 100, HEIGHT / 2);
        }
        return next;
      });
    }
  };

  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      const ball = ballRef.current;

      if (gameActive) {
        ball.vy += GRAVITY;
        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.rotation += ball.rotationSpeed;
        ball.vx *= 0.99;
        ball.rotationSpeed *= 0.99;

        if (ball.x - ball.radius < 0) {
          ball.x = ball.radius;
          ball.vx = -ball.vx * 0.8;
          playSound('hit');
        } else if (ball.x + ball.radius > WIDTH) {
          ball.x = WIDTH - ball.radius;
          ball.vx = -ball.vx * 0.8;
          playSound('hit');
        }

        if (ball.y - ball.radius > HEIGHT) {
          setGameActive(false);
          playSound('groan');
          setGameMessage('Você deixou a bola cair! Clique nela para tentar de novo.');
        }
      }

      sparksRef.current.forEach(s => {
        s.x += s.vx;
        s.y += s.vy;
        s.opacity -= 0.025;
      });
      sparksRef.current = sparksRef.current.filter(s => s.opacity > 0);

      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, '#1E1B4B');
      gradient.addColorStop(1, '#064E3B');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 4;
      ctx.strokeRect(50, HEIGHT - 180, 150, 180);
      ctx.strokeRect(WIDTH - 200, HEIGHT - 180, 150, 180);

      sparksRef.current.forEach(s => {
        ctx.save();
        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.max(0, s.opacity);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      ctx.globalAlpha = 1.0;

      if (gameActive && ball.y < HEIGHT - 40) {
        const shadowDist = HEIGHT - ball.y;
        const shadowRadius = Math.max(5, ball.radius * (1 - shadowDist / HEIGHT));
        ctx.beginPath();
        ctx.ellipse(ball.x, HEIGHT - 20, shadowRadius * 1.5, shadowRadius * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fill();
      }

      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(ball.rotation);

      const ballGrad = ctx.createRadialGradient(-ball.radius/3, -ball.radius/3, 2, 0, 0, ball.radius);
      ballGrad.addColorStop(0, '#FFFFFF');
      ballGrad.addColorStop(0.8, '#E2E8F0');
      const isGold = combo >= 10;
      ballGrad.addColorStop(1, isGold ? '#D97706' : '#94A3B8');

      ctx.beginPath();
      ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = isGold ? '#F59E0B' : ballGrad;
      ctx.fill();
      ctx.strokeStyle = isGold ? '#B45309' : '#1E293B';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.strokeStyle = isGold ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, ball.radius * 0.6, (i * Math.PI * 2) / 5, ((i + 1) * Math.PI * 2) / 5);
        ctx.lineTo(0, 0);
        ctx.stroke();
      }
      ctx.restore();

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameActive, combo]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const clickX = ((clientX - rect.left) / rect.width) * WIDTH;
    const clickY = ((clientY - rect.top) / rect.height) * HEIGHT;

    handleKick(clickX, clickY);
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className="w-full max-w-4xl bg-slate-900/60 border border-slate-800 rounded-3xl p-4 md:p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden backdrop-blur-md">
        <div className="flex items-center gap-6 z-10">
          <div className="text-center bg-emerald-500/10 px-4 py-2 rounded-2xl border border-emerald-500/20">
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">Embaixadinhas</span>
            <span className="text-3xl font-black text-white">{combo}</span>
          </div>

          <div className="text-center bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/20">
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">Melhor Combo</span>
            <span className="text-3xl font-black text-amber-400">{highScore}</span>
          </div>
        </div>

        <div className="text-center z-10 flex-1 px-4">
          <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Status</div>
          <div className="text-sm font-bold uppercase text-slate-200">
            {gameMessage}
          </div>
        </div>

        <div className="flex items-center gap-3 z-10">
          <button 
            onClick={startGame}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-emerald-500/25"
          >
            Iniciar Jogo
          </button>
        </div>
      </div>

      <div className="w-full max-w-4xl bg-slate-950 rounded-[36px] p-4 border border-slate-800 shadow-2xl relative">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onMouseDown={handleCanvasClick}
          onTouchStart={handleCanvasClick}
          className="w-full aspect-[900/550] bg-indigo-950 rounded-[28px] border border-indigo-900/80 cursor-pointer select-none touch-none"
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 3. GAME 3: SHOW DO MILHÃO DA COPA (TRIVIA QUIZ)
// ----------------------------------------------------
const QUIZ_QUESTIONS = [
  {
    q: "Qual país é o maior vencedor da história das Copas do Mundo?",
    options: ["Alemanha", "Itália", "Brasil", "Argentina"],
    correct: 2,
    fact: "O Brasil é o único pentacampeão do mundo (1958, 1962, 1970, 1994, 2002)."
  },
  {
    q: "Quem é o maior artilheiro em uma única edição de Copa do Mundo?",
    options: ["Just Fontaine", "Pelé", "Ronaldo", "Miroslav Klose"],
    correct: 0,
    fact: "O francês Just Fontaine marcou incríveis 13 gols na Copa de 1958."
  },
  {
    q: "Qual seleção venceu a Copa do Mundo de 2022 no Catar?",
    options: ["França", "Argentina", "Croácia", "Marrocos"],
    correct: 1,
    fact: "A Argentina venceu a França nos pênaltis em uma das finais mais emocionantes da história."
  },
  {
    q: "Em qual Copa do Mundo o VAR foi utilizado pela primeira vez?",
    options: ["Brasil 2014", "Rússia 2018", "Catar 2022", "África do Sul 2010"],
    correct: 1,
    fact: "O VAR estreou oficialmente na Copa da Rússia em 2018 para corrigir erros de arbitragem."
  },
  {
    q: "Quem é o jogador com mais partidas disputadas em Copas do Mundo?",
    options: ["Lothar Matthäus", "Lionel Messi", "Miroslav Klose", "Diego Maradona"],
    correct: 1,
    fact: "Lionel Messi alcançou a marca de 26 partidas ao disputar a final da Copa de 2022."
  }
];

function TriviaQuizGame({ playSound }: { playSound: Function }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [gameFinished, setGameFinished] = useState(false);

  const handleAnswer = (optionIdx: number) => {
    if (showFeedback) return;
    setSelectedOpt(optionIdx);
    setShowFeedback(true);
    
    if (optionIdx === QUIZ_QUESTIONS[currentIdx].correct) {
      setScore(prev => prev + 1);
      playSound('cheer');
    } else {
      playSound('groan');
    }
  };

  const handleNext = () => {
    setSelectedOpt(null);
    setShowFeedback(false);
    if (currentIdx + 1 < QUIZ_QUESTIONS.length) {
      setCurrentIdx(prev => prev + 1);
    } else {
      setGameFinished(true);
      playSound('whistle');
    }
  };

  const restartQuiz = () => {
    setCurrentIdx(0);
    setSelectedOpt(null);
    setShowFeedback(false);
    setScore(0);
    setGameFinished(false);
    playSound('whistle');
  };

  return (
    <div className="w-full max-w-2xl bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-md flex flex-col items-center">
      <div className="w-full flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">
          Pergunta {currentIdx + 1} de {QUIZ_QUESTIONS.length}
        </span>
        <span className="text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl">
          Acertos: {score}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {!gameFinished ? (
          <motion.div 
            key={currentIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full space-y-6"
          >
            <h2 className="text-xl md:text-2xl font-bold text-white text-center">
              {QUIZ_QUESTIONS[currentIdx].q}
            </h2>

            <div className="grid grid-cols-1 gap-3">
              {QUIZ_QUESTIONS[currentIdx].options.map((opt, idx) => {
                const isCorrect = idx === QUIZ_QUESTIONS[currentIdx].correct;
                const isSelected = idx === selectedOpt;
                
                let buttonStyle = 'bg-slate-800/50 hover:bg-slate-700/50 text-slate-200 border-slate-700/40';
                if (showFeedback) {
                  if (isCorrect) {
                    buttonStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300';
                  } else if (isSelected) {
                    buttonStyle = 'bg-red-500/20 border-red-500 text-red-300';
                  } else {
                    buttonStyle = 'bg-slate-900/30 border-slate-800/50 opacity-40 text-slate-500';
                  }
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    disabled={showFeedback}
                    className={`p-4 rounded-xl border text-left font-semibold text-sm transition-all ${buttonStyle} flex justify-between items-center`}
                  >
                    <span>{opt}</span>
                    {showFeedback && isCorrect && <span className="text-emerald-400 text-xs font-black">CORRETO</span>}
                    {showFeedback && isSelected && !isCorrect && <span className="text-red-400 text-xs font-black">ERRADO</span>}
                  </button>
                );
              })}
            </div>

            {showFeedback && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex flex-col gap-2"
              >
                <div className="flex gap-2 items-center text-xs text-amber-400 font-bold uppercase tracking-wider">
                  <Sparkles size={14} /> Fato Histórico
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {QUIZ_QUESTIONS[currentIdx].fact}
                </p>
                <button
                  onClick={handleNext}
                  className="w-full mt-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black uppercase tracking-widest text-xs rounded-xl transition-all"
                >
                  Continuar
                </button>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-6"
          >
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-500 mx-auto mb-4">
              <Trophy size={32} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">Quiz Concluído!</h2>
            <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
              Você acertou {score} de {QUIZ_QUESTIONS.length} perguntas sobre a história da Copa do Mundo!
            </p>
            <button
              onClick={restartQuiz}
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black uppercase tracking-wider text-xs rounded-xl transition-all"
            >
              Jogar Novamente
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------
// 4. GAME 4: PONG DE FUTEBOL (FOOTBALL PONG)
// ----------------------------------------------------
function FootballPongGame({ soundEnabled, playSound }: { soundEnabled: boolean; playSound: Function }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [gameActive, setGameActive] = useState(false);
  const [gameMessage, setGameMessage] = useState('Clique em "Iniciar Partida" para começar!');

  const WIDTH = 900;
  const HEIGHT = 550;

  const pongStateRef = useRef({
    ball: { x: WIDTH / 2, y: HEIGHT / 2, vx: 5, vy: 3, radius: 12 },
    playerPaddle: { y: HEIGHT / 2 - 45, height: 90, width: 15 },
    aiPaddle: { y: HEIGHT / 2 - 45, height: 90, width: 15 },
    playerTargetY: HEIGHT / 2 - 45,
    ballSpeed: 6,
    gameActive: false
  });

  const startPong = () => {
    setScore({ player: 0, ai: 0 });
    pongStateRef.current.gameActive = true;
    setGameActive(true);
    setGameMessage('Defenda e rebata a bola!');
    playSound('whistle');
    resetBall(1);
  };

  const resetBall = (direction: number) => {
    const state = pongStateRef.current;
    state.ball.x = WIDTH / 2;
    state.ball.y = HEIGHT / 2 + (Math.random() - 0.5) * 100;
    state.ballSpeed = 6;
    state.ball.vx = direction * state.ballSpeed;
    state.ball.vy = (Math.random() - 0.5) * 6;
  };

  // Touch & Mouse paddle movement listener
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientY = e.touches[0].clientY;
    } else {
      clientY = e.clientY;
    }

    const relativeY = ((clientY - rect.top) / rect.height) * HEIGHT;
    const state = pongStateRef.current;
    state.playerPaddle.y = Math.max(0, Math.min(HEIGHT - state.playerPaddle.height, relativeY - state.playerPaddle.height / 2));
  };

  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      const state = pongStateRef.current;

      if (state.gameActive) {
        // 1. Update Ball Position
        state.ball.x += state.ball.vx;
        state.ball.y += state.ball.vy;

        // 2. Wall Collisions (Top & Bottom)
        if (state.ball.y - state.ball.radius < 0) {
          state.ball.y = state.ball.radius;
          state.ball.vy = -state.ball.vy;
          playSound('hit');
        } else if (state.ball.y + state.ball.radius > HEIGHT) {
          state.ball.y = HEIGHT - state.ball.radius;
          state.ball.vy = -state.ball.vy;
          playSound('hit');
        }

        // 3. AI Paddle Movement (Follows ball with a bit of delay/error rate)
        const aiCenter = state.aiPaddle.y + state.aiPaddle.height / 2;
        const targetDiff = state.ball.y - aiCenter;
        
        // Simple easing AI
        state.aiPaddle.y += targetDiff * 0.085;
        state.aiPaddle.y = Math.max(0, Math.min(HEIGHT - state.aiPaddle.height, state.aiPaddle.y));

        // 4. Ball & Paddle Collisions (Left / Player Paddle)
        const leftPaddleX = 30;
        if (state.ball.vx < 0 && 
            state.ball.x - state.ball.radius <= leftPaddleX + state.playerPaddle.width && 
            state.ball.x - state.ball.radius >= leftPaddleX - 10) {
          if (state.ball.y >= state.playerPaddle.y && state.ball.y <= state.playerPaddle.y + state.playerPaddle.height) {
            
            // Calculate hit factor to adjust vertical rebound angle
            const relativeIntersectY = (state.playerPaddle.y + (state.playerPaddle.height / 2)) - state.ball.y;
            const normalizedIntersectY = relativeIntersectY / (state.playerPaddle.height / 2);
            
            state.ballSpeed += 0.5; // Increase speed slightly
            state.ball.vx = state.ballSpeed;
            state.ball.vy = -normalizedIntersectY * 5;
            playSound('kick');
          }
        }

        // 5. Ball & Paddle Collisions (Right / AI Paddle)
        const rightPaddleX = WIDTH - 30 - state.aiPaddle.width;
        if (state.ball.vx > 0 && 
            state.ball.x + state.ball.radius >= rightPaddleX && 
            state.ball.x + state.ball.radius <= rightPaddleX + 10) {
          if (state.ball.y >= state.aiPaddle.y && state.ball.y <= state.aiPaddle.y + state.aiPaddle.height) {
            
            const relativeIntersectY = (state.aiPaddle.y + (state.aiPaddle.height / 2)) - state.ball.y;
            const normalizedIntersectY = relativeIntersectY / (state.aiPaddle.height / 2);
            
            state.ballSpeed += 0.5;
            state.ball.vx = -state.ballSpeed;
            state.ball.vy = -normalizedIntersectY * 5;
            playSound('kick');
          }
        }

        // 6. Score check (Left/Right Goals)
        if (state.ball.x < 0) {
          // AI scored
          playSound('groan');
          setScore(prev => {
            const next = { ...prev, ai: prev.ai + 1 };
            if (next.ai >= 5) {
              state.gameActive = false;
              setGameActive(false);
              setGameMessage('Fim de Jogo! O adversário ganhou por ' + next.ai + ' a ' + next.player);
            } else {
              resetBall(1);
            }
            return next;
          });
        } else if (state.ball.x > WIDTH) {
          // Player scored
          playSound('cheer');
          setScore(prev => {
            const next = { ...prev, player: prev.player + 1 };
            if (next.player >= 5) {
              state.gameActive = false;
              setGameActive(false);
              setGameMessage('🏆 Vitória! Você venceu por ' + next.player + ' a ' + next.ai);
            } else {
              resetBall(-1);
            }
            return next;
          });
        }
      }

      // Render Pong Field
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      
      // Grass pitch gradients
      const pitchGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      pitchGrad.addColorStop(0, '#022C22');
      pitchGrad.addColorStop(1, '#064E3B');
      ctx.fillStyle = pitchGrad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Pitch outlines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, WIDTH - 20, HEIGHT - 20);

      // Center Line
      ctx.beginPath();
      ctx.moveTo(WIDTH / 2, 10);
      ctx.lineTo(WIDTH / 2, HEIGHT - 10);
      ctx.stroke();

      // Draw Paddles (Goalie Gloves)
      // Player Paddle (Left - Blue)
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(30, state.playerPaddle.y, state.playerPaddle.width, state.playerPaddle.height);
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 2;
      ctx.strokeRect(30, state.playerPaddle.y, state.playerPaddle.width, state.playerPaddle.height);

      // AI Paddle (Right - Red)
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(WIDTH - 30 - state.aiPaddle.width, state.aiPaddle.y, state.aiPaddle.width, state.aiPaddle.height);
      ctx.strokeStyle = '#DC2626';
      ctx.strokeRect(WIDTH - 30 - state.aiPaddle.width, state.aiPaddle.y, state.aiPaddle.width, state.aiPaddle.height);

      // Draw Ball (Soccer ball)
      ctx.save();
      ctx.translate(state.ball.x, state.ball.y);
      ctx.beginPath();
      ctx.arc(0, 0, state.ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(0, 0, state.ball.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameActive]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Score details */}
      <div className="w-full max-w-4xl bg-slate-900/60 border border-slate-800 rounded-3xl p-4 md:p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="text-center bg-blue-500/10 px-4 py-2 rounded-2xl border border-blue-500/20">
            <span className="text-[10px] text-slate-400 uppercase font-black block">Seu Placar</span>
            <span className="text-3xl font-black text-white">{score.player}</span>
          </div>
          <div className="text-center bg-red-500/10 px-4 py-2 rounded-2xl border border-red-500/20">
            <span className="text-[10px] text-slate-400 uppercase font-black block">Adversário</span>
            <span className="text-3xl font-black text-white">{score.ai}</span>
          </div>
        </div>

        <div className="text-center flex-1 px-4">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-widest block mb-1">Status</span>
          <span className="text-sm font-bold text-slate-200">{gameMessage}</span>
        </div>

        <button
          onClick={startPong}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black text-xs uppercase tracking-wider transition-all"
        >
          Iniciar Partida
        </button>
      </div>

      <div className="w-full max-w-4xl bg-slate-950 rounded-[36px] p-4 border border-slate-800 shadow-2xl">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onMouseMove={handleMouseMove}
          onTouchMove={handleMouseMove}
          className="w-full aspect-[900/550] bg-emerald-950 rounded-[28px] border border-emerald-900/80 cursor-ns-resize select-none touch-none"
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------
// MAIN PAGE COMPONENT WITH TAB SELECTOR
// ----------------------------------------------------
export default function GamePage() {
  const [activeTab, setActiveTab] = useState<'botao' | 'embaixadinhas' | 'quiz' | 'pong'>('botao');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playSound = (type: 'kick' | 'hit' | 'cheer' | 'groan' | 'whistle') => {
    if (!soundEnabled) return;
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      if (type === 'kick') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'hit') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'whistle') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.setValueAtTime(1500, now + 0.08);
        osc.frequency.setValueAtTime(1200, now + 0.16);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'cheer') {
        const bufferSize = ctx.sampleRate * 1.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.linearRampToValueAtTime(800, now + 1.0);
        
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.4);
        
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 1.5);
      } else if (type === 'groan') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.5);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {
      console.warn("Audio Context error:", e);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans">
      <Navbar />

      <main className="max-w-6xl mx-auto p-4 md:p-12 flex flex-col items-center">
        
        <div className="text-center mb-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-3"
          >
            <Gamepad2 size={16} />
            <span className="text-xs font-black uppercase tracking-widest">Arena de Mini-Games</span>
          </motion.div>
          
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Mini-Games Arena
          </h1>
          <p className="text-sm text-slate-400 font-medium max-w-xl mx-auto mt-2">
            Divirta-se jogando os mini-games de futebol retrô e teste suas habilidades físicas diretamente pelo painel do bolão!
          </p>
        </div>

        {/* Tab Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl mb-8">
          {/* Tab Button Football */}
          <button
            onClick={() => {
              setActiveTab('botao');
              playSound('whistle');
            }}
            className={`p-4 rounded-3xl border text-left transition-all relative overflow-hidden group ${
              activeTab === 'botao'
                ? 'bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-500/10'
                : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/60'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className={`p-2.5 rounded-xl ${activeTab === 'botao' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
                <Target size={20} />
              </div>
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Futebol de Botão</h3>
            <p className="text-[10px] text-slate-400 leading-normal">
              Disputa estratégica contra a IA. Arraste e rebata os botões azuis em física 2D.
            </p>
          </button>

          {/* Tab Keepie Uppie */}
          <button
            onClick={() => {
              setActiveTab('embaixadinhas');
              playSound('whistle');
            }}
            className={`p-4 rounded-3xl border text-left transition-all relative overflow-hidden group ${
              activeTab === 'embaixadinhas'
                ? 'bg-emerald-600/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/60'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className={`p-2.5 rounded-xl ${activeTab === 'embaixadinhas' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                <Zap size={20} />
              </div>
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Embaixadinhas</h3>
            <p className="text-[10px] text-slate-400 leading-normal">
              Desafio viciante de reflexos. Mantenha a bola no ar clicando com precisão.
            </p>
          </button>

          {/* Tab Trivia Quiz */}
          <button
            onClick={() => {
              setActiveTab('quiz');
              playSound('whistle');
            }}
            className={`p-4 rounded-3xl border text-left transition-all relative overflow-hidden group ${
              activeTab === 'quiz'
                ? 'bg-amber-600/10 border-amber-500/50 shadow-lg shadow-amber-500/10'
                : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/60'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className={`p-2.5 rounded-xl ${activeTab === 'quiz' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                <HelpCircle size={20} />
              </div>
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Show da Copa</h3>
            <p className="text-[10px] text-slate-400 leading-normal">
              Jogo de perguntas e respostas sobre a história das Copas do Mundo FIFA.
            </p>
          </button>

          {/* Tab Football Pong */}
          <button
            onClick={() => {
              setActiveTab('pong');
              playSound('whistle');
            }}
            className={`p-4 rounded-3xl border text-left transition-all relative overflow-hidden group ${
              activeTab === 'pong'
                ? 'bg-purple-600/10 border-purple-500/50 shadow-lg shadow-purple-500/10'
                : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/60'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className={`p-2.5 rounded-xl ${activeTab === 'pong' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-400'}`}>
                <Activity size={20} />
              </div>
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Pong de Futebol</h3>
            <p className="text-[10px] text-slate-400 leading-normal">
              Controle a luva de goleiro, defenda os chutes do adversário e marque gols.
            </p>
          </button>
        </div>

        {/* Global Sound Control */}
        <div className="flex items-center gap-2 mb-6 bg-slate-900/40 border border-slate-800/80 px-4 py-2 rounded-2xl">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white"
          >
            {soundEnabled ? <Volume2 size={16} className="text-emerald-400" /> : <VolumeX size={16} className="text-red-400" />}
            Som: {soundEnabled ? 'Ativado' : 'Mutado'}
          </button>
        </div>

        {/* Active Game Renders */}
        <div className="w-full flex justify-center">
          {activeTab === 'botao' && (
            <ButtonFootballGame soundEnabled={soundEnabled} playSound={playSound} />
          )}
          {activeTab === 'embaixadinhas' && (
            <KeepieUppieGame soundEnabled={soundEnabled} playSound={playSound} />
          )}
          {activeTab === 'quiz' && (
            <TriviaQuizGame playSound={playSound} />
          )}
          {activeTab === 'pong' && (
            <FootballPongGame soundEnabled={soundEnabled} playSound={playSound} />
          )}
        </div>

      </main>
    </div>
  );
}
