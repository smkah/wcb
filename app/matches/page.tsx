'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Filter, Save, Loader2, CheckCircle2, LayoutGrid, List as ListIcon, Edit2, LayoutList, RefreshCw, History } from 'lucide-react';
import Image from 'next/image';
import Flag from 'react-world-flags';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import MatchHistoryModal from '@/components/MatchHistoryModal';

import { WORLD_CUP_DATA } from '@/lib/data';
import { getFlagCode } from '@/lib/countries';

export default function MatchesPage() {
  const [guesses, setGuesses] = useState<Record<string, { scoreA: string, scoreB: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'compact' | 'list'>('grid');
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [historyModal, setHistoryModal] = useState<{ isOpen: boolean; teamA: string; teamB: string }>({
    isOpen: false,
    teamA: '',
    teamB: ''
  });

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      setLoadingMatches(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        // Fetch matches
        const { data: matchesData, error: matchesError } = await supabase
          .from('matches')
          .select('*')
          .order('date', { ascending: true })
          .order('time', { ascending: true });
        
        if (matchesError) throw matchesError;
        
        const finalMatches = (matchesData && matchesData.length > 0) ? matchesData : WORLD_CUP_DATA.matches;
        setMatches(finalMatches);

        // Fetch existing guesses if user is logged in
        if (user) {
          const { data: guessesData, error: guessesError } = await supabase
            .from('guesses')
            .select('*')
            .eq('profile_id', user.id);
          
          if (!guessesError && guessesData) {
            const guessesMap: Record<string, { scoreA: string, scoreB: string }> = {};
            guessesData.forEach(g => {
              guessesMap[g.match_id] = { scoreA: String(g.score1), scoreB: String(g.score2) };
            });
            setGuesses(guessesMap);
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setMatches(WORLD_CUP_DATA.matches);
      } finally {
        setLoadingMatches(false);
      }
    };

    checkUserAndFetchData();
  }, []);

  const isAdmin = user?.email === 'samukahweb@gmail.com';

  // Group matches: by group for group stage, by round for knockout
  const groupedMatches = matches.reduce((acc, match) => {
    const isGroupStage = match.round.toLowerCase().includes('matchday') || match.group;
    const groupKey = match.group ? `GRUPO ${match.group}` : match.round.toUpperCase();
    
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(match);
    return acc;
  }, {} as Record<string, any[]>);

  const handleScoreChange = (matchId: string, team: 'A' | 'B', value: string) => {
    setGuesses(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId] || { scoreA: '', scoreB: '' },
        [team === 'A' ? 'scoreA' : 'scoreB']: value.replace(/[^0-9]/g, '')
      }
    }));
  };

  const handleSaveGuess = async (matchId: string) => {
    if (!user) {
      toast.error("Você precisa estar logado para salvar palpites!");
      return;
    }

    const guess = guesses[matchId];
    if (!guess?.scoreA || !guess?.scoreB) {
      toast.error("Preencha ambos os placares!");
      return;
    }

    setSaving(matchId);
    try {
      const { error } = await supabase
        .from('guesses')
        .upsert({
          profile_id: user.id,
          match_id: matchId,
          score1: parseInt(guess.scoreA),
          score2: parseInt(guess.scoreB),
          updated_at: new Date().toISOString()
        }, { onConflict: 'profile_id, match_id' });

      if (error) throw error;
      
      toast.success("Palpite salvo com sucesso!");
      setSaved(matchId);
      setTimeout(() => setSaved(null), 2000);
    } catch (err: any) {
      toast.error("Erro ao salvar palpite: " + (err.message || "Tente novamente"));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100">
      <Navbar />

      {loadingMatches ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <RefreshCw size={48} className="animate-spin text-emerald-500 mb-4" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Buscando Confrontos...</p>
        </div>
      ) : (
        <main className="max-w-7xl mx-auto p-4 md:p-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-400 mb-2">Calendário Oficial</p>
            <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter flex items-center gap-4">
              PARTIDAS
            </h1>
          </div>
          
          <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700/50">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
              title="Grade"
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setViewMode('compact')}
              className={`p-3 rounded-xl transition-all ${viewMode === 'compact' ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
              title="Compacto"
            >
              <LayoutList size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
              title="Lista"
            >
              <ListIcon size={20} />
            </button>
          </div>
        </header>

        <div className="space-y-20">
          {Object.entries(groupedMatches).map(([round, roundMatches], sectionIdx) => (
            <motion.section 
              key={round}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sectionIdx * 0.1 }}
            >
              <div className="flex items-center gap-6 mb-8">
                <h2 className="text-xl font-black uppercase tracking-tighter text-emerald-400">
                  {round}
                </h2>
                <div className="h-px flex-1 bg-slate-800" />
              </div>

              <div className={`grid gap-6 ${
                viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2' : 
                viewMode === 'compact' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 
                'grid-cols-1'
              }`}>
                {(roundMatches as any[]).map((match, i) => {
                  const guess = guesses[match.id] || { scoreA: '', scoreB: '' };
                  const isSaving = saving === match.id;
                  const isSaved = saved === match.id;

                  if (viewMode === 'list') {
                    return (
                      <motion.div
                        key={match.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.01 }}
                        className="glass p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-emerald-500/30 transition-all"
                      >
                        <div className="flex items-center gap-4 min-w-[120px]">
                           <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900/50 px-3 py-1 rounded-md">
                             {new Date(match.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()} — {match.time.split(' ')[0]}
                           </span>
                        </div>

                        <div className="flex items-center gap-4 flex-1 justify-center">
                          <div className="flex items-center gap-2 w-16 md:w-40 justify-end">
                            <span className="font-bold text-[10px] md:text-sm uppercase truncate">{match.team1}</span>
                            <div className="w-6 h-4 md:w-8 md:h-5 bg-slate-900 rounded-sm overflow-hidden flex-shrink-0 border border-slate-700">
                              <Flag code={getFlagCode(match.team1)} className="w-full h-full object-cover" />
                            </div>
                          </div>

                          <div className="flex items-center gap-1 md:gap-2">
                            <input
                              type="text"
                              value={guess.scoreA}
                              onChange={(e) => handleScoreChange(match.id, 'A', e.target.value)}
                              className="w-8 h-8 md:w-10 md:h-10 bg-slate-900 rounded-lg border border-slate-700 text-center font-bold text-sm md:text-lg focus:border-emerald-500 outline-none"
                              placeholder="0"
                            />
                            <span className="font-black text-slate-700 italic">X</span>
                            <input
                              type="text"
                              value={guess.scoreB}
                              onChange={(e) => handleScoreChange(match.id, 'B', e.target.value)}
                              className="w-8 h-8 md:w-10 md:h-10 bg-slate-900 rounded-lg border border-slate-700 text-center font-bold text-sm md:text-lg focus:border-emerald-500 outline-none"
                              placeholder="0"
                            />
                          </div>

                          <div className="flex items-center gap-2 w-16 md:w-40">
                            <div className="w-6 h-4 md:w-8 md:h-5 bg-slate-900 rounded-sm overflow-hidden flex-shrink-0 border border-slate-700">
                              <Flag code={getFlagCode(match.team2)} className="w-full h-full object-cover" />
                            </div>
                            <span className="font-bold text-[10px] md:text-sm uppercase truncate">{match.team2}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setHistoryModal({ isOpen: true, teamA: match.team1, teamB: match.team2 })}
                            className="p-2.5 text-slate-500 hover:text-emerald-400 transition-colors bg-slate-900/50 rounded-xl"
                            title="Histórico de Confrontos"
                          >
                            <History size={16} />
                          </button>
                          {isAdmin && (
                            <button className="p-2.5 text-slate-500 hover:text-cyan-400 transition-colors" title="Editar Jogo">
                              <Edit2 size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleSaveGuess(match.id)}
                            disabled={!guess.scoreA || !guess.scoreB || isSaving}
                            className={`p-2.5 rounded-xl transition-all ${
                              isSaved ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-500 hover:text-emerald-400 bg-slate-900/50 hover:bg-emerald-400/10 disabled:opacity-30'
                            }`}
                          >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : isSaved ? <CheckCircle2 size={18} /> : <Save size={18} />}
                          </button>
                        </div>
                      </motion.div>
                    );
                  }

                  return (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className={`glass rounded-[32px] group hover:border-emerald-500/30 transition-all ${viewMode === 'compact' ? 'p-6' : 'p-8'}`}
                    >
                      <div className={`flex justify-between items-center ${viewMode === 'compact' ? 'mb-6' : 'mb-8'}`}>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-0.5 glass-emerald text-emerald-400 text-[9px] font-black rounded-lg uppercase tracking-widest">
                            {match.round}
                          </span>
                          <button
                            onClick={() => setHistoryModal({ isOpen: true, teamA: match.team1, teamB: match.team2 })}
                            className="p-1 px-2 bg-slate-800/50 text-slate-400 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-400 transition-all"
                            title="Retrospecto"
                          >
                            <History size={10} />
                          </button>
                          {isAdmin && (
                            <button className="p-1 px-2 bg-cyan-500/10 text-cyan-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-cyan-500/20" title="Gerenciar Jogo">
                              <Edit2 size={10} />
                            </button>
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          {new Date(match.date).toLocaleString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()} — {match.time.split(' ')[0]}
                        </span>
                      </div>

                      <div className={`flex items-center justify-between gap-4 ${viewMode === 'compact' ? 'mb-6' : 'mb-10'}`}>
                        <div className="flex flex-col items-center gap-3 flex-1 text-center">
                          <div className={`relative ${viewMode === 'compact' ? 'w-12 h-8' : 'w-16 h-10'} bg-slate-900 rounded-sm border border-slate-700 overflow-hidden flex items-center justify-center shadow-inner text-white`}>
                            <Flag code={getFlagCode(match.team1)} className="w-full h-full object-cover" fallback={<span className="font-bold text-[10px]">{match.team1.substring(0,3).toUpperCase()}</span>} />
                          </div>
                          <span className={`font-bold uppercase tracking-tight line-clamp-1 ${viewMode === 'compact' ? 'text-sm' : 'text-base'}`}>{match.team1}</span>
                        </div>

                        <div className={`flex items-center ${viewMode === 'compact' ? 'gap-2' : 'gap-4'}`}>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={guess.scoreA}
                            onChange={(e) => handleScoreChange(match.id, 'A', e.target.value)}
                            placeholder="0"
                            className={`${viewMode === 'compact' ? 'w-10 h-12 text-xl sm:w-12 sm:h-14 sm:text-2xl' : 'w-12 h-16 text-2xl sm:w-16 sm:h-20 sm:text-4xl'} text-center font-black bg-slate-900 rounded-2xl border border-slate-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-800`}
                          />
                          <span className={`font-black text-slate-700 italic ${viewMode === 'compact' ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>X</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={guess.scoreB}
                            onChange={(e) => handleScoreChange(match.id, 'B', e.target.value)}
                            placeholder="0"
                            className={`${viewMode === 'compact' ? 'w-10 h-12 text-xl sm:w-12 sm:h-14 sm:text-2xl' : 'w-12 h-16 text-2xl sm:w-16 sm:h-20 sm:text-4xl'} text-center font-black bg-slate-900 rounded-2xl border border-slate-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-800`}
                          />
                        </div>

                        <div className="flex flex-col items-center gap-3 flex-1 text-center">
                          <div className={`relative ${viewMode === 'compact' ? 'w-12 h-8' : 'w-16 h-10'} bg-slate-900 rounded-sm border border-slate-700 overflow-hidden flex items-center justify-center shadow-inner text-white`}>
                            <Flag code={getFlagCode(match.team2)} className="w-full h-full object-cover" fallback={<span className="font-bold text-[10px]">{match.team2.substring(0,3).toUpperCase()}</span>} />
                          </div>
                          <span className={`font-bold uppercase tracking-tight line-clamp-1 ${viewMode === 'compact' ? 'text-sm' : 'text-base'}`}>{match.team2}</span>
                        </div>
                      </div>

                      <div className={`flex flex-col sm:flex-row items-center justify-between border-t border-slate-700/50 ${viewMode === 'compact' ? 'pt-4 gap-4' : 'pt-8 gap-6'}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">{match.ground}</span>
                        </div>
                        <button
                          onClick={() => handleSaveGuess(match.id)}
                          disabled={!guess.scoreA || !guess.scoreB || isSaving}
                          className={`flex items-center justify-center gap-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all w-full sm:w-auto shadow-lg shadow-emerald-500/20 ${
                            viewMode === 'compact' ? 'px-4 py-2' : 'px-8 py-3'
                          } ${
                            isSaved 
                              ? 'bg-emerald-500 text-slate-900' 
                              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none'
                          }`}
                        >
                          {isSaving ? <Loader2 size={14} className="animate-spin" /> : isSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                          {isSaved ? 'SALVO' : viewMode === 'compact' ? 'SALVAR' : 'SALVAR PALPITE'}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.section>
          ))}
        </div>
      </main>
      )}

      <MatchHistoryModal 
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal(prev => ({ ...prev, isOpen: false }))}
        teamA={historyModal.teamA}
        teamB={historyModal.teamB}
      />
    </div>
  );
}
