'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { RefreshCw, TrendingUp, Users } from 'lucide-react';

interface EvolutionChartProps {
  profileId: string;
}

interface MatchHistoryPoint {
  matchId: string;
  matchLabel: string;
  matchDesc: string;
  pointsEarned: number;
  cumulative: number;
}

interface ParticipantData {
  profileId: string;
  name: string;
  color: string;
  pointsHistory: MatchHistoryPoint[];
}

const PALETTE = [
  '#10B981', // Emerald (User)
  '#06B6D4', // Cyan
  '#A855F7', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#84CC16', // Lime
];

export default function EvolutionChart({ profileId }: EvolutionChartProps) {
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredProfileId, setHoveredProfileId] = useState<string | null>(null);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        // Buscar perfis, palpites e partidas finalizadas em paralelo
        const [profilesRes, guessesRes, matchesRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, username').order('points', { ascending: false }),
          supabase.from('guesses').select('profile_id, points_earned, match_id'),
          supabase.from('matches').select('id, team1, team2, score1, score2, date, time').not('score1', 'is', null).not('score2', 'is', null)
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (guessesRes.error) throw guessesRes.error;
        if (matchesRes.error) throw matchesRes.error;

        const profilesData = profilesRes.data;
        const allGuessesData = guessesRes.data;
        const matchesData = matchesRes.data;

        // 4. Mapear palpites por profile_id e match_id
        const guessesMap = new Map<string, Map<string, number>>();
        (allGuessesData || []).forEach(g => {
          if (!guessesMap.has(g.profile_id)) {
            guessesMap.set(g.profile_id, new Map());
          }
          guessesMap.get(g.profile_id)!.set(g.match_id, g.points_earned || 0);
        });

        // 5. Ordenar partidas cronologicamente
        const finishedMatches = (matchesData || [])
          .sort((a, b) => {
            const dateTimeA = new Date(`${a.date}T${a.time || '00:00'}`);
            const dateTimeB = new Date(`${b.date}T${b.time || '00:00'}`);
            return dateTimeA.getTime() - dateTimeB.getTime();
          });

        // 6. Construir o histórico de pontos de cada participante
        let colorIdx = 1; // Começa em 1 para deixar a paleta 0 (Emerald) reservada para o usuário logado se possível
        const ptsList: ParticipantData[] = (profilesData || []).map((p) => {
          let runningTotal = 0;
          const userGuesses = guessesMap.get(p.id) || new Map<string, number>();

          const pointsHistory = finishedMatches.map((m, idx) => {
            const earned = userGuesses.get(m.id) || 0;
            runningTotal += earned;
            return {
              matchId: m.id,
              matchLabel: `Jogo ${idx + 1}`,
              matchDesc: `${m.team1} ${m.score1} x ${m.score2} ${m.team2}`,
              pointsEarned: earned,
              cumulative: runningTotal
            };
          });

          const isCurrentUser = p.id === profileId;
          const color = isCurrentUser 
            ? PALETTE[0] 
            : PALETTE[colorIdx++ % PALETTE.length];

          return {
            profileId: p.id,
            name: p.full_name || p.username || 'Participante',
            color,
            pointsHistory
          };
        });

        setParticipants(ptsList);
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

  // Se não houver dados
  const hasHistory = participants.length > 0 && participants[0].pointsHistory.length > 0;
  if (!hasHistory) {
    return (
      <div className="h-64 flex flex-col items-center justify-center bg-slate-900/20 rounded-3xl border border-slate-800/50 backdrop-blur-md p-6 text-center">
        <TrendingUp className="text-slate-600 mb-3" size={32} />
        <p className="text-xs font-bold text-slate-400">Nenhum dado de evolução ainda.</p>
        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Os pontos serão exibidos aqui à medida que as partidas terminarem.</p>
      </div>
    );
  }

  const finishedMatchesCount = participants[0].pointsHistory.length;

  // Configurações do SVG
  const width = 600;
  const height = 240;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Achar o maior valor acumulado entre todos os participantes para definir o eixo Y
  let maxPoints = 5;
  participants.forEach(p => {
    p.pointsHistory.forEach(pt => {
      if (pt.cumulative > maxPoints) {
        maxPoints = pt.cumulative;
      }
    });
  });

  // Converter pontos em coordenadas SVG
  const getX = (idx: number) => {
    if (finishedMatchesCount <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (idx / (finishedMatchesCount - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return paddingTop + chartHeight - (val / maxPoints) * chartHeight;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Achar o índice do jogo mais próximo baseado na posição X do mouse
    let closestIndex = 0;
    let minDiff = Infinity;

    for (let i = 0; i < finishedMatchesCount; i++) {
      const px = getX(i) * (rect.width / width);
      const diff = Math.abs(px - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }

    setActiveMatchIndex(closestIndex);
    const x = getX(closestIndex);

    // Pegar o participante ativo ou o usuário logado para posicionar a altura do tooltip
    const activeParticipant = participants.find(p => p.profileId === (hoveredProfileId || profileId)) || participants[0];
    const activePt = activeParticipant.pointsHistory[closestIndex];

    setTooltipPos({
      x: (x / width) * rect.width,
      y: (getY(activePt.cumulative) / height) * rect.height - 110
    });
  };

  const handleMouseLeave = () => {
    setActiveMatchIndex(null);
  };

  // Obter detalhes do ponto ativo para exibir no tooltip
  const getTooltipData = () => {
    if (activeMatchIndex === null) return null;
    const matchInfo = participants[0].pointsHistory[activeMatchIndex];
    
    // Ordenar participantes por pontuação acumulada neste jogo específico
    const standingsAtMatch = participants
      .map(p => ({
        name: p.name,
        color: p.color,
        isUser: p.profileId === profileId,
        isHovered: p.profileId === hoveredProfileId,
        pointsEarned: p.pointsHistory[activeMatchIndex].pointsEarned,
        cumulative: p.pointsHistory[activeMatchIndex].cumulative
      }))
      .sort((a, b) => b.cumulative - a.cumulative);

    return {
      label: matchInfo.matchLabel,
      matchDesc: matchInfo.matchDesc,
      standings: standingsAtMatch
    };
  };

  const tooltipData = getTooltipData();

  return (
    <div ref={containerRef} className="relative w-full bg-slate-950/40 p-6 rounded-3xl border border-slate-800/80 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Evolução do Campeonato</h4>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Evolução dos pontos acumulados de todos os participantes</p>
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
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines horizontais */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = paddingTop + chartHeight * ratio;
            const value = Math.round(maxPoints * (1 - ratio));
            return (
              <g key={i} className="opacity-15">
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

          {/* Linha vertical de guia quando passa o mouse */}
          {activeMatchIndex !== null && (
            <line
              x1={getX(activeMatchIndex)}
              y1={paddingTop}
              x2={getX(activeMatchIndex)}
              y2={paddingTop + chartHeight}
              stroke="#10B981"
              strokeOpacity="0.3"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
          )}

          {/* Linhas de cada participante */}
          {participants.map((p) => {
            const isUser = p.profileId === profileId;
            const isHovered = p.profileId === hoveredProfileId;
            const hasActiveHover = hoveredProfileId !== null;
            
            // Definir opacidade dinâmica baseada no foco
            let opacity = 0.35;
            if (isUser) opacity = 0.85;
            if (hasActiveHover) {
              opacity = isHovered ? 1.0 : 0.1;
            }

            let path = '';
            p.pointsHistory.forEach((pt, idx) => {
              const x = getX(idx);
              const y = getY(pt.cumulative);
              if (idx === 0) {
                path = `M ${x} ${y}`;
              } else {
                path += ` L ${x} ${y}`;
              }
            });

            return (
              <path
                key={p.profileId}
                d={path}
                fill="none"
                stroke={p.color}
                strokeWidth={isUser || isHovered ? 3.5 : 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={opacity}
                className="transition-all duration-200"
                filter={isUser || isHovered ? 'url(#glow)' : undefined}
              />
            );
          })}

          {/* Marcadores circulares para a linha sob hover ou principal */}
          {participants.map((p) => {
            const isUser = p.profileId === profileId;
            const isHovered = p.profileId === hoveredProfileId;
            
            // Apenas renderizar círculos para o usuário logado ou para a linha focada
            if (!isUser && !isHovered) return null;

            return p.pointsHistory.map((pt, idx) => {
              const x = getX(idx);
              const y = getY(pt.cumulative);
              const isMatchIndexActive = activeMatchIndex === idx;

              return (
                <circle
                  key={`${p.profileId}-${idx}`}
                  cx={x}
                  cy={y}
                  r={isMatchIndexActive ? 5 : 2.5}
                  fill={p.color}
                  stroke="#050B1A"
                  strokeWidth={isMatchIndexActive ? 1.5 : 1}
                  className="transition-all duration-150"
                  opacity={hoveredProfileId && !isHovered ? 0.1 : 1}
                />
              );
            });
          })}
        </svg>

        {/* Tooltip Dinâmico */}
        {activeMatchIndex !== null && tooltipData && (
          <div 
            className="absolute pointer-events-none z-50 bg-slate-900/95 border border-slate-800/80 p-3.5 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col gap-2 text-left min-w-[200px] transition-all duration-150 ease-out"
            style={{ 
              left: `${tooltipPos.x}px`, 
              top: `${tooltipPos.y}px`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                {tooltipData.label}
              </span>
              <span className="text-[10px] font-black text-white truncate max-w-[200px] mt-0.5">
                {tooltipData.matchDesc}
              </span>
            </div>
            
            <div className="flex flex-col gap-1 border-t border-slate-800/80 pt-2 max-h-[140px] overflow-y-auto">
              {tooltipData.standings.slice(0, 5).map((player, idx) => (
                <div 
                  key={player.name} 
                  className={`flex items-center justify-between text-[9px] gap-4 ${
                    player.isUser ? 'font-black text-emerald-400' : 'text-slate-400'
                  }`}
                  style={{ opacity: hoveredProfileId && !player.isHovered ? 0.4 : 1 }}
                >
                  <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: player.color }} />
                    <span className="truncate">{player.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] text-slate-500">({player.pointsEarned >= 0 ? `+${player.pointsEarned}` : player.pointsEarned})</span>
                    <span className="font-mono font-bold text-white">{player.cumulative} pts</span>
                  </div>
                </div>
              ))}
              {tooltipData.standings.length > 5 && (
                <div className="text-[8px] text-slate-500 text-center font-bold uppercase mt-0.5">
                  + {tooltipData.standings.length - 5} participantes
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legenda interativa de participantes */}
      <div className="mt-6 border-t border-slate-800/60 pt-4">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-2.5">
          Participantes (Passe o mouse para destacar)
        </span>
        <div className="flex flex-wrap gap-2.5">
          {participants.map((p) => {
            const isUser = p.profileId === profileId;
            const isHovered = p.profileId === hoveredProfileId;
            const hasActiveHover = hoveredProfileId !== null;

            return (
              <button
                key={p.profileId}
                onMouseEnter={() => setHoveredProfileId(p.profileId)}
                onMouseLeave={() => setHoveredProfileId(null)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${
                  isHovered 
                    ? 'bg-slate-800/80 border-slate-700 text-white' 
                    : isUser
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : hasActiveHover
                        ? 'bg-slate-900/10 border-slate-950 text-slate-600 opacity-40'
                        : 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                <span>{p.name} {isUser && '(Você)'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
