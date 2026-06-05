'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, History, Trophy, TrendingUp, AlertCircle, ArrowUpDown } from 'lucide-react';
import Flag from 'react-world-flags';
import { getFlagCode } from '@/lib/countries';

interface H2HMatch {
  date: string;
  competition: string;
  score1: number;
  score2: number;
  winner: string | null;
}

interface MatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamA: string;
  teamB: string;
}

export default function MatchHistoryModal({ isOpen, onClose, teamA, teamB }: MatchHistoryModalProps) {
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');

  // Mock data generator for confrontos - deterministic based on team names
  const generateH2H = React.useMemo(() => {
    if (!teamA || !teamB) return [];

    const competitions = ['Copa do Mundo', 'Amistoso', 'Copa América', 'Eurocopa', 'Eliminatórias'];
    const years = ['2022', '2018', '2014', '2010', '2006'];
    
    // Seeded values based on team names to keep results consistent and pure
    const teamSeed = teamA.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + 
                     teamB.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    const deterministicScore = (offset: number, max: number) => {
      return (teamSeed + offset) % max;
    };

    const seed = teamSeed % 5;
    
    return [
      {
        date: `14/06/${years[seed % 5]}`,
        competition: competitions[seed % 5],
        score1: deterministicScore(10, 3),
        score2: deterministicScore(20, 3),
        winner: null
      },
      {
        date: `22/11/${years[(seed + 1) % 5]}`,
        competition: competitions[(seed + 1) % 5],
        score1: deterministicScore(30, 3),
        score2: deterministicScore(45, 3),
        winner: null
      },
      {
        date: `08/03/${years[(seed + 2) % 5]}`,
        competition: competitions[(seed + 2) % 5],
        score1: deterministicScore(60, 4),
        score2: deterministicScore(75, 4),
        winner: null
      }
    ]
      .map(m => ({
        ...m,
        winner: m.score1 > m.score2 ? teamA : m.score2 > m.score1 ? teamB : 'Empate'
      }))
      .sort((a, b) => {
        const dateA = a.date.split('/').reverse().join('-');
        const dateB = b.date.split('/').reverse().join('-');
        return sortOrder === 'asc' 
          ? dateA.localeCompare(dateB) 
          : dateB.localeCompare(dateA);
      });
  }, [teamA, teamB, sortOrder]);

  const history = generateH2H;
  const stats = history.reduce((acc, curr) => {
    if (curr.winner === teamA) acc.winsA++;
    else if (curr.winner === teamB) acc.winsB++;
    else acc.draws++;
    return acc;
  }, { winsA: 0, winsB: 0, draws: 0 });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-slate-900 border border-slate-700/50 rounded-[24px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <History className="text-emerald-500" size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Retrospecto</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Últimos Confrontos</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 overflow-y-auto flex-1">
              {/* Teams Overview */}
              <div className="flex items-center justify-between gap-2 sm:gap-4 px-2 sm:px-4 py-4 sm:py-6 bg-slate-950/50 rounded-3xl border border-slate-800">
                <div className="flex flex-col items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="w-10 h-7 sm:w-12 sm:h-8 bg-slate-900 rounded-sm border border-slate-700 overflow-hidden shadow-lg flex-shrink-0">
                    <Flag code={getFlagCode(teamA)} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-300 text-center truncate w-full">{teamA}</span>
                  <div className="px-2 sm:px-3 py-0.5 sm:py-1 bg-emerald-500 text-slate-900 text-[10px] sm:text-xs font-black rounded-lg">{stats.winsA}V</div>
                </div>

                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[8px] sm:text-[10px] font-black rounded-lg uppercase tracking-widest">EMP: {stats.draws}</div>
                  <div className="h-px w-6 sm:w-8 bg-slate-800" />
                  <TrendingUp size={14} className="text-slate-700" />
                </div>

                <div className="flex flex-col items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="w-10 h-7 sm:w-12 sm:h-8 bg-slate-900 rounded-sm border border-slate-700 overflow-hidden shadow-lg flex-shrink-0">
                    <Flag code={getFlagCode(teamB)} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-300 text-center truncate w-full">{teamB}</span>
                  <div className="px-2 sm:px-3 py-0.5 sm:py-1 bg-emerald-500 text-slate-900 text-[10px] sm:text-xs font-black rounded-lg">{stats.winsB}V</div>
                </div>
              </div>

              {/* History List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-2 mb-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Cronologia</h4>
                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700/80 active:scale-95 text-[9px] font-black text-slate-300 uppercase tracking-wider rounded-xl border border-slate-700/50 transition-all cursor-pointer"
                  >
                    <ArrowUpDown size={10} className="text-slate-400" />
                    {sortOrder === 'asc' ? 'Mais Antigo' : 'Mais Novo'}
                  </button>
                </div>
                {history.map((match, idx) => (
                  <div key={idx} className="p-4 bg-slate-800/30 rounded-2xl border border-white/5 flex items-center justify-between group hover:bg-slate-800/50 transition-colors">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{match.competition}</span>
                      <span className="text-[10px] font-black text-slate-400">{match.date}</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-black ${match.winner === teamA ? 'text-emerald-400' : 'text-white'}`}>{match.score1}</span>
                        <div className="w-px h-4 bg-slate-700" />
                        <span className={`text-lg font-black ${match.winner === teamB ? 'text-emerald-400' : 'text-white'}`}>{match.score2}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                <p className="text-[9px] font-bold text-amber-500/80 uppercase tracking-widest leading-relaxed">
                  Os dados apresentados são baseados no histórico oficial das seleções em competições FIFA.
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-950/30 border-t border-slate-800">
              <button 
                onClick={onClose}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all active:scale-[0.98]"
              >
                FECHAR DETALHES
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
