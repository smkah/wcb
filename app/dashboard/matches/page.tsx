'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Filter, Save, Loader2, CheckCircle2, LayoutGrid, List as ListIcon, Edit2, LayoutList, RefreshCw, History, BarChart2 } from 'lucide-react';
import Image from 'next/image';
import Flag from 'react-world-flags';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import MatchHistoryModal from '@/components/MatchHistoryModal';
import MatchStatsModal from '@/components/MatchStatsModal';

import { WORLD_CUP_DATA } from '@/lib/data';
import { getFlagCode } from '@/lib/countries';
import { formatMatchDate, formatMatchTime } from '@/lib/utils';

export default function MatchesPage() {
  const [guesses, setGuesses] = useState<Record<string, { scoreA: string, scoreB: string, yellowCardsWinner?: string, hasRedCard?: boolean, custom_guesses?: Record<string, string> }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'compact' | 'list'>('grid');
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'matches' | 'standings'>('matches');
  const [groupPredictions, setGroupPredictions] = useState<Record<string, { firstPlace: string, secondPlace: string, thirdPlace: string, thirdPlaceQualified: boolean }>>({});
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [groupResults, setGroupResults] = useState<any[]>([]);
  const [historyModal, setHistoryModal] = useState<{ isOpen: boolean; teamA: string; teamB: string }>({
    isOpen: false,
    teamA: '',
    teamB: ''
  });
  const [statsModal, setStatsModal] = useState<{ isOpen: boolean; match: any }>({
    isOpen: false,
    match: null
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

        // Fetch group results
        const { data: resultsData } = await supabase.from('group_results').select('*');
        if (resultsData) setGroupResults(resultsData);

        // Fetch existing guesses if user is logged in
        if (user) {
          const { data: guessesData, error: guessesError } = await supabase
            .from('guesses')
            .select('*')
            .eq('profile_id', user.id);
          
          if (!guessesError && guessesData) {
            const guessesMap: Record<string, { scoreA: string, scoreB: string, yellowCardsWinner?: string, hasRedCard?: boolean, custom_guesses?: Record<string, string> }> = {};
            guessesData.forEach(g => {
              guessesMap[g.match_id] = { 
                scoreA: String(g.score1), 
                scoreB: String(g.score2),
                yellowCardsWinner: g.yellow_cards_winner || '',
                hasRedCard: g.has_red_card !== null ? g.has_red_card : undefined,
                custom_guesses: g.custom_guesses || {}
              };
            });
            setGuesses(guessesMap);
          }

          // Fetch group predictions
          const { data: predData } = await supabase
            .from('group_predictions')
            .select('*')
            .eq('profile_id', user.id);
          
          if (predData) {
            const predMap: Record<string, { firstPlace: string, secondPlace: string, thirdPlace: string, thirdPlaceQualified: boolean }> = {};
            predData.forEach(p => {
              predMap[p.group_letter] = {
                firstPlace: p.first_place || '',
                secondPlace: p.second_place || '',
                thirdPlace: p.third_place || '',
                thirdPlaceQualified: p.third_place_qualified || false
              };
            });
            setGroupPredictions(predMap);
          }

          // Fetch user groups with custom rules
          const { data: membersData } = await supabase
            .from('group_members')
            .select('group_id, groups(id, name, custom_rules)')
            .eq('profile_id', user.id);
          
          if (membersData) {
            setUserGroups(membersData.map((m: any) => m.groups).filter(Boolean));
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

  const isMatchStarted = (match: any) => {
    if (!match?.date) return false;
    const timePart = match.time ? match.time.split(' ')[0] : '00:00';
    const matchDateTime = new Date(`${match.date}T${timePart}`);
    return new Date() > matchDateTime;
  };

  const getGroupPredictionsDeadline = () => {
    if (!matches || matches.length === 0) return null;
    const groupMatches = matches.filter(m => m.group);
    if (groupMatches.length === 0) return null;

    const sorted = [...groupMatches].sort((a, b) => {
      const timeA = a.time ? a.time.split(' ')[0] : '00:00';
      const timeB = b.time ? b.time.split(' ')[0] : '00:00';
      const dateTimeA = new Date(`${a.date}T${timeA}`);
      const dateTimeB = new Date(`${b.date}T${timeB}`);
      return dateTimeA.getTime() - dateTimeB.getTime();
    });

    const firstRoundMatches: any[] = [];
    const groupCounts: Record<string, number> = {};
    for (const match of sorted) {
      const g = match.group;
      if (!groupCounts[g]) groupCounts[g] = 0;
      if (groupCounts[g] < 2) {
        firstRoundMatches.push(match);
        groupCounts[g]++;
      }
    }

    const sortedFirstRound = [...firstRoundMatches].sort((a, b) => {
      const timeA = a.time ? a.time.split(' ')[0] : '00:00';
      const timeB = b.time ? b.time.split(' ')[0] : '00:00';
      const dateTimeA = new Date(`${a.date}T${timeA}`);
      const dateTimeB = new Date(`${b.date}T${timeB}`);
      return dateTimeA.getTime() - dateTimeB.getTime();
    });

    if (sortedFirstRound.length === 0) return null;
    const lastMatch = sortedFirstRound[sortedFirstRound.length - 1];
    const timePart = lastMatch.time ? lastMatch.time.split(' ')[0] : '00:00';
    const lastMatchStart = new Date(`${lastMatch.date}T${timePart}`);
    return new Date(lastMatchStart.getTime() + 2 * 60 * 60 * 1000);
  };

  const isGroupPredictionsLocked = () => {
    const deadline = getGroupPredictionsDeadline();
    if (!deadline) return false;
    return new Date() > deadline;
  };

  // Group matches: by group for group stage, by round for knockout
  const groupedMatches = matches.reduce((acc, match) => {
    const isGroupStage = match.round.toLowerCase().includes('matchday') || match.group;
    const groupKey = match.group ? `GRUPO ${match.group}` : match.round.toUpperCase();
    
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(match);
    return acc;
  }, {} as Record<string, any[]>);

  const handleCustomGuessChange = (matchId: string, groupId: string, ruleName: string, value: string) => {
    setGuesses(prev => {
      const matchGuess = prev[matchId] || { scoreA: '', scoreB: '', custom_guesses: {} };
      return {
        ...prev,
        [matchId]: {
          ...matchGuess,
          custom_guesses: {
            ...(matchGuess.custom_guesses || {}),
            [`${groupId}_${ruleName}`]: value
          }
        }
      };
    });
  };

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

    const match = matches.find(m => m.id === matchId);
    if (!isAdmin && match && isMatchStarted(match)) {
      toast.error("Este jogo já iniciou! Não é mais permitido salvar palpites.");
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
          yellow_cards_winner: guess.yellowCardsWinner || null,
          has_red_card: guess.hasRedCard !== undefined ? guess.hasRedCard : null,
          custom_guesses: guess.custom_guesses || {},
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

  const getTeamsByGroup = (groupLetter: string) => {
    const groupMatches = matches.filter(m => m.group === groupLetter);
    const teams = new Set<string>();
    groupMatches.forEach(m => {
      if (m.team1) teams.add(m.team1);
      if (m.team2) teams.add(m.team2);
    });
    return Array.from(teams);
  };

  const totalQualifiedThirds = Object.values(groupPredictions).filter(p => p.thirdPlaceQualified).length;

  const handleThirdPlaceQualifiedToggle = (groupLetter: string) => {
    const current = groupPredictions[groupLetter]?.thirdPlaceQualified || false;
    if (!current && totalQualifiedThirds >= 8) {
      toast.warning("Você já selecionou os 8 melhores terceiros colocados!");
      return;
    }

    setGroupPredictions(prev => {
      const groupPred = prev[groupLetter] || { firstPlace: '', secondPlace: '', thirdPlace: '', thirdPlaceQualified: false };
      return {
        ...prev,
        [groupLetter]: {
          ...groupPred,
          thirdPlaceQualified: !current
        }
      };
    });
  };

  const handleSaveGroupPrediction = async (groupLetter: string) => {
    if (!user) {
      toast.error("Você precisa estar logado para salvar palpites!");
      return;
    }

    if (!isAdmin && isGroupPredictionsLocked()) {
      toast.error("O prazo para palpites da fase de grupos expirou (fim da primeira rodada)!");
      return;
    }

    const pred = groupPredictions[groupLetter];
    if (!pred?.firstPlace || !pred?.secondPlace || !pred?.thirdPlace) {
      toast.error("Selecione o 1º, 2º e 3º colocados do grupo!");
      return;
    }

    if (pred.firstPlace === pred.secondPlace || pred.firstPlace === pred.thirdPlace || pred.secondPlace === pred.thirdPlace) {
      toast.error("Os times selecionados devem ser diferentes!");
      return;
    }

    setSavingGroup(groupLetter);
    try {
      const { error } = await supabase
        .from('group_predictions')
        .upsert({
          profile_id: user.id,
          group_letter: groupLetter,
          first_place: pred.firstPlace,
          second_place: pred.secondPlace,
          third_place: pred.thirdPlace,
          third_place_qualified: pred.thirdPlaceQualified || false,
          updated_at: new Date().toISOString()
        }, { onConflict: 'profile_id, group_letter' });

      if (error) throw error;
      toast.success(`Palpite do Grupo ${groupLetter} salvo com sucesso!`);
    } catch (err: any) {
      toast.error("Erro ao salvar palpite de grupo: " + (err.message || "Tente novamente"));
    } finally {
      setSavingGroup(null);
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

        {/* Sub-tab switcher */}
        <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700/50 mb-12 max-w-md">
          <button
            onClick={() => setActiveSubTab('matches')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center ${
              activeSubTab === 'matches'
                ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Partidas
          </button>
          <button
            onClick={() => setActiveSubTab('standings')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center ${
              activeSubTab === 'standings'
                ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Fase de Grupos (Classificação)
          </button>
        </div>

        {activeSubTab === 'matches' ? (
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
                  const isStarted = !isAdmin && isMatchStarted(match);

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
                             {formatMatchDate(match.date)} — {formatMatchTime(match.time)}
                           </span>
                        </div>

                        <div className="flex flex-col flex-1 w-full gap-3">
                          <div className="flex items-center gap-2 sm:gap-4 justify-center w-full">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-end min-w-0">
                              <span className="font-bold text-[10px] md:text-sm uppercase truncate text-right">{match.team1}</span>
                              <div className="w-6 h-4 md:w-8 md:h-5 bg-slate-900 rounded-sm overflow-hidden flex-shrink-0 border border-slate-700">
                                <Flag code={getFlagCode(match.team1)} className="w-full h-full object-cover" />
                              </div>
                            </div>

                            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                              <input
                                type="text"
                                value={guess.scoreA}
                                onChange={(e) => handleScoreChange(match.id, 'A', e.target.value)}
                                disabled={isStarted}
                                className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-900 rounded-lg border border-slate-700 text-center font-bold text-xs sm:text-lg focus:border-emerald-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="0"
                              />
                              <span className="font-black text-slate-700 italic text-xs sm:text-base">X</span>
                              <input
                                type="text"
                                value={guess.scoreB}
                                onChange={(e) => handleScoreChange(match.id, 'B', e.target.value)}
                                disabled={isStarted}
                                className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-900 rounded-lg border border-slate-700 text-center font-bold text-xs sm:text-lg focus:border-emerald-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="0"
                              />
                            </div>

                            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                              <div className="w-6 h-4 md:w-8 md:h-5 bg-slate-900 rounded-sm overflow-hidden flex-shrink-0 border border-slate-700">
                                <Flag code={getFlagCode(match.team2)} className="w-full h-full object-cover" />
                              </div>
                              <span className="font-bold text-[10px] md:text-sm uppercase truncate text-left">{match.team2}</span>
                            </div>
                          </div>

                          {/* Standard card rules (Yellow / Red cards) */}
                          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 space-y-2 flex-shrink-0 mt-2">
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-400">Cartões do Jogo</p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-between">
                              {/* Yellow Cards Winner */}
                              <div className="flex items-center justify-between gap-2 flex-1">
                                <span className="text-[9px] text-slate-400 font-bold">Mais Amarelos (3 pts)</span>
                                <div className="flex gap-0.5 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                                  {[
                                    { value: match.team1, label: match.team1.substring(0,3).toUpperCase() },
                                    { value: 'Empate', label: 'EMP' },
                                    { value: match.team2, label: match.team2.substring(0,3).toUpperCase() }
                                  ].map((opt, optIdx) => (
                                    <button
                                      key={`${opt.value}-${optIdx}`}
                                      type="button"
                                      disabled={isStarted}
                                      onClick={() => {
                                        setGuesses(prev => ({
                                          ...prev,
                                          [match.id]: {
                                            ...prev[match.id] || { scoreA: '', scoreB: '' },
                                            yellowCardsWinner: opt.value
                                          }
                                        }));
                                      }}
                                      className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all ${
                                        guess.yellowCardsWinner === opt.value
                                          ? 'bg-amber-500 text-slate-900 shadow'
                                          : 'text-slate-500 hover:text-slate-300'
                                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Red Card */}
                              <div className="flex items-center justify-between gap-2 flex-1">
                                <span className="text-[9px] text-slate-400 font-bold">Terá Vermelho? (4 pts)</span>
                                <div className="flex gap-0.5 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                                  {[
                                    { value: true, label: 'SIM' },
                                    { value: false, label: 'NÃO' }
                                  ].map(opt => (
                                    <button
                                      key={String(opt.value)}
                                      type="button"
                                      disabled={isStarted}
                                      onClick={() => {
                                        setGuesses(prev => ({
                                          ...prev,
                                          [match.id]: {
                                            ...prev[match.id] || { scoreA: '', scoreB: '' },
                                            hasRedCard: opt.value
                                          }
                                        }));
                                      }}
                                      className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all ${
                                        guess.hasRedCard === opt.value
                                          ? 'bg-emerald-500 text-slate-900 shadow'
                                          : 'text-slate-500 hover:text-slate-300'
                                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Custom rules in List mode */}
                          {userGroups.length > 0 && userGroups.some(g => (Array.isArray(g.custom_rules) ? g.custom_rules : Object.keys(g.custom_rules || {})).length > 0) && (
                            <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 space-y-2 flex-shrink-0">
                              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-400">Regras Personalizadas</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                                {userGroups.map((group: any) => {
                                  const rules = Array.isArray(group.custom_rules) 
                                    ? group.custom_rules 
                                    : Object.entries(group.custom_rules || {}).map(([k, v]) => ({ regra: k, resposta: '', pontos: Number(v) }));
                                  if (rules.length === 0) return null;
                                  return rules.map((rule: any) => {
                                    const ruleName = rule.regra;
                                    const points = rule.pontos;
                                    const key = `${group.id}_${ruleName}`;
                                    const customGuess = guess.custom_guesses?.[key] || '';
                                    return (
                                      <div key={key} className="flex items-center justify-between gap-2 border-b border-white/5 pb-1">
                                        <span className="text-[9px] text-slate-400 font-bold truncate max-w-[150px]" title={`${group.name}: ${ruleName}`}>{ruleName} <span className="text-[7px] text-slate-500 font-normal">({points} pts)</span></span>
                                        <input
                                          type="text"
                                          value={customGuess}
                                          onChange={(e) => handleCustomGuessChange(match.id, group.id, ruleName, e.target.value)}
                                          disabled={isStarted}
                                          placeholder="Palpite"
                                          className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[9px] text-white focus:border-emerald-500 outline-none w-20 text-center font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                      </div>
                                    );
                                  });
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setStatsModal({ isOpen: true, match })}
                            className="p-2.5 text-slate-500 hover:text-emerald-400 transition-colors bg-slate-900/50 rounded-xl"
                            title="Estatísticas e Palpites"
                          >
                            <BarChart2 size={16} />
                          </button>
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
                            disabled={!guess.scoreA || !guess.scoreB || isSaving || isStarted}
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
                          {formatMatchDate(match.date)} — {formatMatchTime(match.time)}
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
                            disabled={isStarted}
                            placeholder="0"
                            className={`${viewMode === 'compact' ? 'w-9 h-11 text-lg sm:w-12 sm:h-14 sm:text-2xl' : 'w-10 h-14 text-xl sm:w-16 sm:h-20 sm:text-4xl'} text-center font-black bg-slate-900 rounded-2xl border border-slate-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed`}
                          />
                          <span className={`font-black text-slate-700 italic ${viewMode === 'compact' ? 'text-base sm:text-xl' : 'text-lg sm:text-2xl'}`}>X</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={guess.scoreB}
                            onChange={(e) => handleScoreChange(match.id, 'B', e.target.value)}
                            disabled={isStarted}
                            placeholder="0"
                            className={`${viewMode === 'compact' ? 'w-9 h-11 text-lg sm:w-12 sm:h-14 sm:text-2xl' : 'w-10 h-14 text-xl sm:w-16 sm:h-20 sm:text-4xl'} text-center font-black bg-slate-900 rounded-2xl border border-slate-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed`}
                          />
                        </div>

                        <div className="flex flex-col items-center gap-3 flex-1 text-center">
                          <div className={`relative ${viewMode === 'compact' ? 'w-12 h-8' : 'w-16 h-10'} bg-slate-900 rounded-sm border border-slate-700 overflow-hidden flex items-center justify-center shadow-inner text-white`}>
                            <Flag code={getFlagCode(match.team2)} className="w-full h-full object-cover" fallback={<span className="font-bold text-[10px]">{match.team2.substring(0,3).toUpperCase()}</span>} />
                          </div>
                          <span className={`font-bold uppercase tracking-tight line-clamp-1 ${viewMode === 'compact' ? 'text-sm' : 'text-base'}`}>{match.team2}</span>
                        </div>
                      </div>

                      {/* Standard card rules (Yellow / Red cards) in Grid/Compact Mode */}
                      <div className="mb-6 p-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-3">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-400">Cartões do Jogo</p>
                        
                        <div className="flex flex-col gap-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Mais Cartões Amarelos (3 pts)</span>
                            <div className="flex gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800 w-full sm:w-auto">
                              {[
                                { value: match.team1, label: match.team1 },
                                { value: 'Empate', label: 'Empate' },
                                { value: match.team2, label: match.team2 }
                              ].map((opt, optIdx) => (
                                <button
                                  key={`${opt.value}-${optIdx}`}
                                  type="button"
                                  disabled={isStarted}
                                  onClick={() => {
                                    setGuesses(prev => ({
                                      ...prev,
                                      [match.id]: {
                                        ...prev[match.id] || { scoreA: '', scoreB: '' },
                                        yellowCardsWinner: opt.value
                                      }
                                    }));
                                  }}
                                  className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all flex-1 text-center truncate max-w-[120px] ${
                                    guess.yellowCardsWinner === opt.value
                                      ? 'bg-amber-500 text-slate-900 shadow-md shadow-amber-500/10'
                                      : 'text-slate-500 hover:text-slate-300'
                                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Terá Cartão Vermelho? (4 pts)</span>
                            <div className="flex gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800 w-full sm:w-auto">
                              {[
                                { value: true, label: 'Sim' },
                                { value: false, label: 'Não' }
                              ].map(opt => (
                                <button
                                  key={String(opt.value)}
                                  type="button"
                                  disabled={isStarted}
                                  onClick={() => {
                                    setGuesses(prev => ({
                                      ...prev,
                                      [match.id]: {
                                        ...prev[match.id] || { scoreA: '', scoreB: '' },
                                        hasRedCard: opt.value
                                      }
                                    }));
                                  }}
                                  className={`px-4 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all flex-1 text-center ${
                                    guess.hasRedCard === opt.value
                                      ? 'bg-emerald-500 text-slate-900 shadow-md shadow-emerald-500/10'
                                      : 'text-slate-500 hover:text-slate-300'
                                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Custom rules in Grid and Compact mode */}
                      {userGroups.length > 0 && userGroups.some(g => (Array.isArray(g.custom_rules) ? g.custom_rules : Object.keys(g.custom_rules || {})).length > 0) && (
                        <div className="mb-6 p-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-2.5">
                          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-400">Regras do Bolão</p>
                          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                            {userGroups.map((group: any) => {
                              const rules = Array.isArray(group.custom_rules) 
                                ? group.custom_rules 
                                : Object.entries(group.custom_rules || {}).map(([k, v]) => ({ regra: k, resposta: '', pontos: Number(v) }));
                              if (rules.length === 0) return null;
                              return (
                                <div key={group.id} className="space-y-1">
                                  <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{group.name}</p>
                                  {rules.map((rule: any) => {
                                    const ruleName = rule.regra;
                                    const points = rule.pontos;
                                    const key = `${group.id}_${ruleName}`;
                                    const customGuess = guess.custom_guesses?.[key] || '';
                                    return (
                                      <div key={key} className="flex items-center justify-between gap-2 py-0.5">
                                        <span className="text-[9px] text-slate-300 font-bold truncate max-w-[180px]">{ruleName} <span className="text-[7px] text-slate-500 font-normal">({points} pts)</span></span>
                                        <input
                                          type="text"
                                          value={customGuess}
                                          onChange={(e) => handleCustomGuessChange(match.id, group.id, ruleName, e.target.value)}
                                          disabled={isStarted}
                                          placeholder="Palpite"
                                          className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[9px] text-white focus:border-emerald-500 outline-none w-24 text-center font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className={`flex flex-col sm:flex-row items-center justify-between border-t border-slate-700/50 ${viewMode === 'compact' ? 'pt-4 gap-4' : 'pt-8 gap-6'}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">{match.ground}</span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => setStatsModal({ isOpen: true, match })}
                            className="p-3 bg-slate-900 border border-slate-800 text-slate-500 hover:text-emerald-400 rounded-xl transition-all"
                            title="Estatísticas e Palpites"
                          >
                            <BarChart2 size={14} />
                          </button>
                          <button
                            onClick={() => handleSaveGuess(match.id)}
                            disabled={!guess.scoreA || !guess.scoreB || isSaving || isStarted}
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
                    </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.section>
          ))}
        </div>
        ) : (
          <div className="space-y-12 pb-24">
            <div className="glass p-8 rounded-[32px] border-emerald-500/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight text-white">Palpite de Classificação dos Grupos</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Selecione o 1º, 2º e 3º colocados de cada grupo (A a L).</p>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-center min-w-[200px]">
                  <p className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Melhores Terceiros Selecionados</p>
                  <p className={`text-2xl font-black mt-1 ${totalQualifiedThirds === 8 ? 'text-emerald-400' : 'text-amber-500'}`}>
                    {totalQualifiedThirds} <span className="text-slate-600 text-sm">/ 8</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map(groupLetter => {
                const groupTeams = getTeamsByGroup(groupLetter);
                const pred = groupPredictions[groupLetter] || { firstPlace: '', secondPlace: '', thirdPlace: '', thirdPlaceQualified: false };
                const actual = groupResults.find(r => r.group_letter === groupLetter);
                const isSaving = savingGroup === groupLetter;
                const isGroupLocked = !isAdmin && isGroupPredictionsLocked();

                return (
                  <motion.div
                    key={groupLetter}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass p-6 rounded-[28px] border border-slate-800 hover:border-emerald-500/15 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
                        <h3 className="text-xl font-black text-white">GRUPO {groupLetter}</h3>
                        {actual && actual.first_place && (
                          <span className="text-[9px] font-bold text-slate-500 uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                            Fase Finalizada
                          </span>
                        )}
                      </div>

                      <div className="space-y-4">
                        {/* 1º Lugar */}
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest">1º Colocado (3 pts)</label>
                          <select
                            value={pred.firstPlace}
                            disabled={isGroupLocked}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGroupPredictions(prev => ({
                                ...prev,
                                [groupLetter]: {
                                  ...prev[groupLetter] || { firstPlace: '', secondPlace: '', thirdPlace: '', thirdPlaceQualified: false },
                                  firstPlace: val
                                }
                              }));
                            }}
                            className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-bold text-xs text-white focus:border-emerald-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">Selecionar...</option>
                            {groupTeams.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>

                        {/* 2º Lugar */}
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest">2º Colocado (2 pts)</label>
                          <select
                            value={pred.secondPlace}
                            disabled={isGroupLocked}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGroupPredictions(prev => ({
                                ...prev,
                                [groupLetter]: {
                                  ...prev[groupLetter] || { firstPlace: '', secondPlace: '', thirdPlace: '', thirdPlaceQualified: false },
                                  secondPlace: val
                                }
                              }));
                            }}
                            className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-bold text-xs text-white focus:border-emerald-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">Selecionar...</option>
                            {groupTeams.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>

                        {/* 3º Lugar */}
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest">3º Colocado (1 pt se classificar)</label>
                          <select
                            value={pred.thirdPlace}
                            disabled={isGroupLocked}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGroupPredictions(prev => ({
                                ...prev,
                                [groupLetter]: {
                                  ...prev[groupLetter] || { firstPlace: '', secondPlace: '', thirdPlace: '', thirdPlaceQualified: false },
                                  thirdPlace: val
                                }
                              }));
                            }}
                            className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-bold text-xs text-white focus:border-emerald-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">Selecionar...</option>
                            {groupTeams.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>

                        {/* Melhor Terceiro Qualificado Switch */}
                        {pred.thirdPlace && (
                          <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-2xl border border-slate-900 mt-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Qualifica como melhor 3º?</span>
                            <button
                              type="button"
                              disabled={isGroupLocked}
                              onClick={() => handleThirdPlaceQualifiedToggle(groupLetter)}
                              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                pred.thirdPlaceQualified
                                  ? 'bg-amber-500 text-slate-900 shadow-md shadow-amber-500/10'
                                  : 'bg-slate-900 text-slate-600 hover:text-slate-400'
                              } disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                              {pred.thirdPlaceQualified ? 'Sim (Qualifica)' : 'Não'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Display actual results if present */}
                      {actual && actual.first_place && (
                        <div className="mt-4 p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 space-y-1">
                          <p className="text-[8px] font-black uppercase text-emerald-400 tracking-widest">Resultado Real</p>
                          <p className="text-[9px] font-bold text-slate-300">
                            1º: {actual.first_place} <br/> 2º: {actual.second_place} <br/> 3º: {actual.third_place} 
                            {actual.third_place_qualified ? ' (Classificado)' : ' (Eliminado)'}
                          </p>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleSaveGroupPrediction(groupLetter)}
                      disabled={!pred.firstPlace || !pred.secondPlace || !pred.thirdPlace || isSaving || isGroupLocked}
                      className="w-full mt-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                      {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Salvar Grupo {groupLetter}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </main>
      )}

      <MatchHistoryModal 
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal(prev => ({ ...prev, isOpen: false }))}
        teamA={historyModal.teamA}
        teamB={historyModal.teamB}
      />

      <MatchStatsModal 
        isOpen={statsModal.isOpen}
        onClose={() => setStatsModal(prev => ({ ...prev, isOpen: false }))}
        match={statsModal.match}
      />
    </div>
  );
}
