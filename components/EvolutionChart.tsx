'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { RefreshCw, TrendingUp } from 'lucide-react';

interface EvolutionChartProps {
  profileId: string;
}

interface PointData {
  index: number;
  label: string;
  match: string;
  pointsEarned: number;
  cumulative: number;
}

export default function EvolutionChart({ profileId }: EvolutionChartProps) {
  const [data, setData] = useState<PointData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePoint, setActivePoint] = useState<PointData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        // 1. Buscar palpites do usuário
        const { data: guessesData, error: guessesError } = await supabase
          .from('guesses')
          .select('points_earned, match_id')
          .eq('profile_id', profileId);

        if (guessesError) throw guessesError;

        // 2. Buscar todas as partidas finalizadas
        const { data: matchesData, error: matchesError } = await supabase
          .from('matches')
          .select('id, team1, team2, score1, score2, date, time')
          .not('score1', 'is', null)
          .not('score2', 'is', null);

        if (matchesError) throw matchesError;

        // 3. Mapear palpites por match_id
        const guessesMap = new Map<string, number>();
        (guessesData || []).forEach(g => {
          guessesMap.set(g.match_id, g.points_earned || 0);
        });

        // 4. Filtrar e ordenar partidas cronologicamente
        const finishedMatches = (matchesData || [])
          .sort((a, b) => {
            const dateTimeA = new Date(`${a.date}T${a.time || '00:00'}`);
            const dateTimeB = new Date(`${b.date}T${b.time || '00:00'}`);
            return dateTimeA.getTime() - dateTimeB.getTime();
          });

        // 5. Construir os pontos acumulados
        let runningTotal = 0;
        const pointsList: PointData[] = finishedMatches.map((m, idx) => {
          const earned = guessesMap.get(m.id) || 0;
          runningTotal += earned;
          return {
            index: idx,
            label: `Jogo ${idx + 1}`,
            match: `${m.team1} ${m.score1} x ${m.score2} ${m.team2}`,
            pointsEarned: earned,
            cumulative: runningTotal
          };
        });

        setData(pointsList);
      } catch (err) {
        console.error('Error calculating evolution data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (profileId) {
      fetchHistory();
    }
  }, [profileId]);

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center bg-slate-900/20 rounded-3xl border border-slate-800/50 backdrop-blur-md">
        <RefreshCw className="animate-spin text-emerald-500 mb-3" size={24} />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Processando Histórico...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center bg-slate-900/20 rounded-3xl border border-slate-800/50 backdrop-blur-md p-6 text-center">
        <TrendingUp className="text-slate-600 mb-3" size={32} />
        <p className="text-xs font-bold text-slate-400">Nenhum dado de evolução ainda.</p>
        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Os pontos serão exibidos aqui à medida que as partidas terminarem.</p>
      </div>
    );
  }

  // Configurações do SVG
  const width = 600;
  const height = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxPoints = Math.max(...data.map(d => d.cumulative), 5); // Garante escala mínima se todos forem 0
  const totalPointsCount = data.length;

  // Converter pontos em coordenadas SVG
  const getX = (idx: number) => {
    if (totalPointsCount <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (idx / (totalPointsCount - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return paddingTop + chartHeight - (val / maxPoints) * chartHeight;
  };

  // Construir a linha do gráfico
  let linePath = '';
  let areaPath = '';

  data.forEach((pt, idx) => {
    const x = getX(idx);
    const y = getY(pt.cumulative);

    if (idx === 0) {
      linePath = `M ${x} ${y}`;
      areaPath = `M ${x} ${paddingTop + chartHeight} L ${x} ${y}`;
    } else {
      linePath += ` L ${x} ${y}`;
      areaPath += ` L ${x} ${y}`;
    }

    if (idx === data.length - 1) {
      areaPath += ` L ${x} ${paddingTop + chartHeight} Z`;
    }
  });

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Encontrar o ponto mais próximo da coordenada X do mouse
    let closestPt = data[0];
    let minDiff = Math.abs(getX(0) * (rect.width / width) - mouseX);

    data.forEach((pt, idx) => {
      const px = getX(idx) * (rect.width / width);
      const diff = Math.abs(px - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestPt = pt;
      }
    });

    if (closestPt) {
      setActivePoint(closestPt);
      const x = getX(closestPt.index);
      const y = getY(closestPt.cumulative);
      
      // Ajustar o tooltip em relação ao container pai
      setTooltipPos({
        x: (x / width) * rect.width,
        y: (y / height) * rect.height - 85
      });
    }
  };

  const handleMouseLeave = () => {
    setActivePoint(null);
  };

  return (
    <div ref={containerRef} className="relative w-full bg-slate-950/40 p-6 rounded-3xl border border-slate-800/80 backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Evolução do Desempenho</h4>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Histórico de pontos acumulados jogo a jogo</p>
        </div>
        <div className="text-right">
          <span className="text-xs font-black text-white bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl">
            {data[data.length - 1].cumulative} pts acumulados
          </span>
        </div>
      </div>

      <div className="relative">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-auto overflow-visible select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines horizontais */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = paddingTop + chartHeight * ratio;
            const value = Math.round(maxPoints * (1 - ratio));
            return (
              <g key={i} className="opacity-20">
                <line 
                  x1={paddingLeft} 
                  y1={y} 
                  x2={width - paddingRight} 
                  y2={y} 
                  stroke="#475569" 
                  strokeWidth="1" 
                  strokeDasharray="4 4" 
                />
                <text 
                  x={paddingLeft - 8} 
                  y={y + 3} 
                  textAnchor="end" 
                  fill="#94A3B8" 
                  className="text-[9px] font-bold"
                >
                  {value}
                </text>
              </g>
            );
          })}

          {/* Área com gradiente */}
          {data.length > 1 && (
            <path d={areaPath} fill="url(#areaGrad)" />
          )}

          {/* Linha principal */}
          {data.length > 1 && (
            <path 
              d={linePath} 
              fill="none" 
              stroke="url(#lineGrad)" 
              strokeWidth="3" 
              strokeLinecap="round"
              filter="url(#glow)"
            />
          )}

          {/* Marcadores circulares */}
          {data.map((pt, idx) => {
            const x = getX(idx);
            const y = getY(pt.cumulative);
            const isActive = activePoint?.index === idx;

            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r={isActive ? 6 : 3}
                fill={isActive ? '#10B981' : '#06B6D4'}
                stroke="#0F172A"
                strokeWidth={isActive ? 2 : 1}
                className="transition-all duration-200"
              />
            );
          })}
        </svg>

        {/* Tooltip HTML Dinâmico em Overlay */}
        {activePoint && (
          <div 
            className="absolute pointer-events-none z-50 bg-slate-900/95 border border-emerald-500/30 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col gap-1 text-left min-w-[160px] transition-all duration-150 ease-out"
            style={{ 
              left: `${tooltipPos.x}px`, 
              top: `${tooltipPos.y}px`,
              transform: 'translateX(-50%)'
            }}
          >
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              {activePoint.label}
            </span>
            <span className="text-xs font-bold text-white truncate max-w-[180px]">
              {activePoint.match}
            </span>
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-800">
              <span className="text-[9px] font-bold text-emerald-400">Ganhos: +{activePoint.pointsEarned} pts</span>
              <span className="text-[10px] font-black text-white">{activePoint.cumulative} pts</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
