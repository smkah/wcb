'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { motion } from 'motion/react';
import { AlertTriangle, Trophy, Users, Star, ArrowUpRight, Calendar, ChevronRight, History, Lock, Check, Loader2, CheckCircle2, Save, Target, Percent, Award } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Flag from 'react-world-flags';
import MatchHistoryModal from '@/components/MatchHistoryModal';
import { toast } from 'sonner';

import { WORLD_CUP_DATA } from '@/lib/data';
import { getFlagCode } from '@/lib/countries';
import { formatMatchDate, formatMatchTime, parseMatchDateTime, normalizeTeamName, mapMatchesToBrazil } from '@/lib/utils';
import EvolutionChart from '@/components/EvolutionChart';
import { BADGES_DEFINITION, calculateUserBadges } from '@/lib/badges';

export default function Dashboard() {
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([
    { label: 'Pontos Totais', value: '0', icon: Star, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Pontos de Hoje', value: '0 pts', icon: Calendar, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Posição no Ranking', value: '-', icon: Trophy, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  ]);
  const [profileName, setProfileName] = useState<string>('');
  const [pendingReminderMatches, setPendingReminderMatches] = useState<any[]>([]);
  const [historyModal, setHistoryModal] = useState<{ isOpen: boolean; teamA: string; teamB: string }>({
    isOpen: false,
    teamA: '',
    teamB: ''
  });
  const [userGuesses, setUserGuesses] = useState<any[]>([]);
  const [userGroupPredictions, setUserGroupPredictions] = useState<any[]>([]);
  const [groupResults, setGroupResults] = useState<any[]>([]);
  const [rankingPosition, setRankingPosition] = useState<number | undefined>(undefined);
  const [todayPoints, setTodayPoints] = useState<number>(0);
  const [top3Profiles, setTop3Profiles] = useState<any[]>([]);
  const [next3DaysMatches, setNext3DaysMatches] = useState<any[]>([]);
  
  // Today's matches states
  const [todayMatches, setTodayMatches] = useState<any[]>([]);
  const [todayGuesses, setTodayGuesses] = useState<Record<string, { score1: string, score2: string, yellow_cards_winner?: string, has_red_card?: boolean }>>({});
  const [savingTodayGuess, setSavingTodayGuess] = useState<Record<string, boolean>>({});
  const [savedTodayGuess, setSavedTodayGuess] = useState<Record<string, boolean>>({});
  const [accuracyStats, setAccuracyStats] = useState<{
    total: number;
    exact: number;
    outcome: number;
    errors: number;
    rate: number;
  }>({ total: 0, exact: 0, outcome: 0, errors: 0, rate: 0 });
  const [recentHistory, setRecentHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) return;
      setLoading(true);
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        let loadedGuesses: any[] = [];
        let loadedMatches: any[] = [];

        if (currentUser) {
          setUser(currentUser);
          
          // Fetch profile for points and full_name
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, points, ranking_position')
            .eq('id', currentUser.id)
            .single();

          let computedRank = 1;
          if (profile) {
            setProfileName(profile.full_name || currentUser.email?.split('@')[0] || '');
            
            // Fetch rank position dynamically based on points
            const { count: rankCount } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .gt('points', profile.points || 0);

            computedRank = rankCount !== null ? rankCount + 1 : 1;
            setRankingPosition(computedRank);
          }

          // Fetch user guesses for badges, points, and stats calculation
          const { data: guessesData } = await supabase
            .from('guesses')
            .select('id, match_id, score1, score2, points_earned, yellow_cards_winner, has_red_card')
            .eq('profile_id', currentUser.id);
          
          if (guessesData) {
            loadedGuesses = guessesData;
            setUserGuesses(guessesData);
          }

          // Fetch top 3 ranking profiles
          const { data: top3Data } = await supabase
            .from('profiles')
            .select('id, full_name, points, avatar_url, username')
            .order('points', { ascending: false })
            .limit(3);
          
          if (top3Data) {
            setTop3Profiles(top3Data);
          }

          // Fetch user group predictions for badges
          const { data: groupPreds } = await supabase
            .from('group_predictions')
            .select('*')
            .eq('profile_id', currentUser.id);
          if (groupPreds) setUserGroupPredictions(groupPreds);

          // Fetch group results for badges
          const { data: resultsData } = await supabase
            .from('group_results')
            .select('*');
          if (resultsData) setGroupResults(resultsData);

          // Update initial stats
          setStats([
            { label: 'Pontos Totais', value: String(profile?.points || 0), icon: Star, color: 'text-amber-400', bg: 'bg-amber-400/10' },
            { label: 'Pontos de Hoje', value: '0 pts', icon: Calendar, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Posição no Ranking', value: `${computedRank}º`, icon: Trophy, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
          ]);
        } else {
          router.push('/login');
          return;
        }

        // Fetch matches
        const { data: matches } = await supabase
          .from('matches')
          .select('*')
          .order('date', { ascending: true })
          .order('time', { ascending: true });
        
        const rawMatches = (matches && matches.length > 0) ? matches : WORLD_CUP_DATA.matches;
        loadedMatches = mapMatchesToBrazil(rawMatches);

        // Filter matches for the next 3 days (Today, Tomorrow, Day After)
        const localDate = new Date();
        const dateStrings: string[] = [];
        for (let i = 0; i < 3; i++) {
          const d = new Date();
          d.setDate(localDate.getDate() + i);
          dateStrings.push(d.toLocaleDateString('en-CA')); // YYYY-MM-DD
        }
        
        const next3Days = loadedMatches.filter((m: any) => dateStrings.includes(m.date));
        setNext3DaysMatches(next3Days);

        // Calculate points won today
        const todayStr = new Date().toLocaleDateString('en-CA');
        const todayGuesses = loadedGuesses.filter(g => {
          const m = loadedMatches.find(match => match.id === g.match_id);
          return m && m.date === todayStr;
        });
        const todayPts = todayGuesses.reduce((acc, curr) => acc + (curr.points_earned || 0), 0);
        setTodayPoints(todayPts);

        // Update today's points in the stats grid
        setStats(prev => prev.map(s => s.label === 'Pontos de Hoje' ? { ...s, value: `+${todayPts} pts` } : s));

        // Filter matches starting within the next 2 hours that the user hasn't predicted yet
        if (currentUser && loadedMatches.length > 0) {
          const guessedMatchIds = new Set((loadedGuesses || []).map((g: any) => g.match_id));
          const now = new Date();
          const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
          
          const pending = loadedMatches.filter((match: any) => {
            if (guessedMatchIds.has(match.id)) return false;
            
            const matchDateTime = parseMatchDateTime(match.date, match.time);
            
            return matchDateTime > now && matchDateTime <= twoHoursFromNow;
          });
          
          setPendingReminderMatches(pending);

          // Find today's matches
          const todayStr = new Date().toLocaleDateString('en-CA');
          const todayM = loadedMatches.filter((m: any) => m.date === todayStr);
          setTodayMatches(todayM);

          // Populate today's guesses state
          const todayGuessesMap: Record<string, any> = {};
          todayM.forEach(m => {
            const existingG = loadedGuesses.find(g => g.match_id === m.id);
            if (existingG) {
              todayGuessesMap[m.id] = {
                score1: String(existingG.score1 ?? ''),
                score2: String(existingG.score2 ?? ''),
                yellow_cards_winner: existingG.yellow_cards_winner || '',
                has_red_card: existingG.has_red_card !== null ? existingG.has_red_card : undefined,
                points_earned: existingG.points_earned !== null ? existingG.points_earned : undefined
              };
            } else {
              todayGuessesMap[m.id] = { score1: '', score2: '', yellow_cards_winner: '', has_red_card: undefined, points_earned: undefined };
            }
          });
          setTodayGuesses(todayGuessesMap);

          // Calculate Accuracy Stats
          const finishedGuessed = loadedGuesses.filter(g => {
            const m = loadedMatches.find(x => x.id === g.match_id);
            return m && m.score1 !== null && m.score2 !== null;
          });

          let exactCount = 0;
          let outcomeCount = 0;
          let errorsCount = 0;

          finishedGuessed.forEach(g => {
            const m = loadedMatches.find(x => x.id === g.match_id);
            if (m) {
              const exactMatch = m.score1 === g.score1 && m.score2 === g.score2;
              const sameOutcome = Math.sign(m.score1 - m.score2) === Math.sign(g.score1 - g.score2);
              if (exactMatch) {
                exactCount++;
              } else if (sameOutcome) {
                outcomeCount++;
              } else {
                errorsCount++;
              }
            }
          });

          const totalFinished = finishedGuessed.length;
          const rate = totalFinished > 0 ? Math.round(((exactCount + outcomeCount) / totalFinished) * 100) : 0;
          setAccuracyStats({
            total: totalFinished,
            exact: exactCount,
            outcome: outcomeCount,
            errors: errorsCount,
            rate
          });

          // Fetch Recent History (Last 3 finished matches with guesses)
          const finishedMatches = loadedMatches.filter((m: any) => m.score1 !== null && m.score2 !== null);
          const historyList = finishedMatches
            .map((match: any) => {
              const guess = loadedGuesses.find(g => g.match_id === match.id);
              return {
                ...match,
                guess: guess || null
              };
            })
            .filter((m: any) => m.guess !== null)
            .sort((a: any, b: any) => {
              const dateA = parseMatchDateTime(a.date, a.time);
              const dateB = parseMatchDateTime(b.date, b.time);
              return dateB.getTime() - dateA.getTime();
            })
            .slice(0, 3);
          setRecentHistory(historyList);
        }
      } catch (err) {
        console.error("Dashboard data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  const isMatchStarted = (match: any) => {
    if (!match?.date) return false;
    const matchDateTime = parseMatchDateTime(match.date, match.time);
    return new Date() > matchDateTime;
  };

  const handleTodayScoreChange = (matchId: string, team: 1 | 2, val: string) => {
    const numericVal = val.replace(/[^0-9]/g, '');
    setTodayGuesses((prev) => {
      const matchGuess = prev[matchId] || { score1: '', score2: '' };
      return {
        ...prev,
        [matchId]: {
          ...matchGuess,
          [team === 1 ? 'score1' : 'score2']: numericVal
        }
      };
    });
  };

  const handleTodayYellowCardsChange = (matchId: string, value: string) => {
    setTodayGuesses((prev) => {
      const matchGuess = prev[matchId] || { score1: '', score2: '' };
      return {
        ...prev,
        [matchId]: {
          ...matchGuess,
          yellow_cards_winner: value
        }
      };
    });
  };

  const handleTodayRedCardChange = (matchId: string, value: boolean) => {
    setTodayGuesses((prev) => {
      const matchGuess = prev[matchId] || { score1: '', score2: '' };
      return {
        ...prev,
        [matchId]: {
          ...matchGuess,
          has_red_card: value
        }
      };
    });
  };

  const handleSaveTodayGuess = async (matchId: string) => {
    if (!user) return;
    const guess = todayGuesses[matchId];
    if (!guess || guess.score1 === '' || guess.score2 === '') {
      toast.error('Preencha ambos os placares!');
      return;
    }

    const match = todayMatches.find(m => m.id === matchId);
    if (!match) return;

    const now = new Date();
    const matchDateTime = parseMatchDateTime(match.date, match.time);
    if (!isAdmin && now >= matchDateTime) {
      toast.error('Este jogo já começou! Não é mais permitido salvar palpites.');
      return;
    }

    setSavingTodayGuess(prev => ({ ...prev, [matchId]: true }));
    try {
      const { error } = await supabase
        .from('guesses')
        .upsert({
          profile_id: user.id,
          match_id: matchId,
          score1: parseInt(guess.score1),
          score2: parseInt(guess.score2),
          yellow_cards_winner: guess.yellow_cards_winner || null,
          has_red_card: guess.has_red_card !== undefined ? guess.has_red_card : null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'profile_id, match_id' });

      if (error) throw error;
      toast.success('Palpite salvo com sucesso!');
      setSavedTodayGuess(prev => ({ ...prev, [matchId]: true }));
      setTimeout(() => {
        setSavedTodayGuess(prev => ({ ...prev, [matchId]: false }));
      }, 2000);

      // Refresh user guesses
      const { data: updatedGuesses } = await supabase
        .from('guesses')
        .select('id, match_id, score1, score2, points_earned, yellow_cards_winner, has_red_card')
        .eq('profile_id', user.id);

      if (updatedGuesses) {
        setUserGuesses(updatedGuesses);
      }
    } catch (err: any) {
      toast.error('Erro ao salvar palpite: ' + (err.message || 'Tente novamente'));
    } finally {
      setSavingTodayGuess(prev => ({ ...prev, [matchId]: false }));
    }
  };


  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6">
        <div className="glass p-12 rounded-[40px] max-w-xl text-center border-amber-500/30">
          <AlertTriangle size={64} className="mx-auto text-amber-500 mb-8" />
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-4 text-white">Configuração Incompleta</h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs leading-loose mb-8">
            As chaves do Supabase não foram encontradas. Para este aplicativo funcionar, você precisa configurar as variáveis <code className="text-emerald-400">NEXT_PUBLIC_SUPABASE_URL</code> e <code className="text-emerald-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> no painel de Secrets ou no arquivo .env.
          </p>
          <Link href="/" className="inline-block px-10 py-4 bg-emerald-500 text-slate-900 font-black uppercase tracking-widest rounded-2xl">Voltar Home</Link>
        </div>
      </div>
    );
  }

  const isAdmin = user?.email === 'samukahweb@gmail.com';

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-emerald-400 bg-[#0F172A]">Carregando...</div>;

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100">
      <Navbar />

      <main className="max-w-7xl mx-auto p-4 md:p-12">
        {/* Admin Banner */}
        {isAdmin && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3 text-emerald-400">
              <Star size={18} fill="currentColor" />
              <span className="text-xs font-black uppercase tracking-widest">Acesso de Administrador Ativo</span>
            </div>
            <Link href="/dashboard/admin" className="px-4 py-1.5 bg-emerald-500 text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-400 transition-colors">
              Painel de Gestão
            </Link>
          </motion.div>
        )}

        {/* Pending Predictions Reminder Banner */}
        {pendingReminderMatches.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-amber-500/10 border border-amber-500/30 rounded-[32px] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-amber-500/5 relative overflow-hidden"
          >
            <div className="flex items-center gap-4 text-amber-500">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle size={24} className="animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-white">Palpites Pendentes!</h4>
                <p className="text-slate-400 text-xs font-medium mt-0.5 leading-relaxed">
                  Você tem {pendingReminderMatches.length} {pendingReminderMatches.length === 1 ? 'partida que começa' : 'partidas que começam'} em menos de 2 horas e ainda não palpitou:{' '}
                  <span className="text-amber-400 font-bold">
                    {pendingReminderMatches.map(m => `${m.team1} vs ${m.team2}`).join(', ')}
                  </span>
                </p>
              </div>
            </div>
            <Link href="/dashboard/matches" className="px-6 py-3 bg-amber-500 text-slate-900 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-amber-400 active:scale-95 transition-all shadow-lg shadow-amber-500/10 shrink-0">
              PALPITAR AGORA
            </Link>
          </motion.div>
        )}
        {/* Welcome Header */}
        <header className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-400 mb-2">Painel de Controle</p>
            <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter">
              OLÁ, <span className="gradient-text italic">{profileName}</span>
            </h1>
          </div>
        </header>
 
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass p-8 rounded-[32px] flex items-center justify-between group hover:border-emerald-500/30 transition-all"
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{stat.label}</p>
                <h3 className="text-4xl font-black tracking-tighter">{stat.value}</h3>
              </div>
              <div className={`w-16 h-16 ${stat.bg} ${stat.color} flex items-center justify-center rounded-2xl shadow-inner shrink-0`}>
                <stat.icon size={32} />
              </div>
            </motion.div>
          ))}
        </div>
 
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Feed */}
          <div className="lg:col-span-2 flex flex-col gap-12">
            {/* Palpites dos Jogos de Hoje */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass p-6 md:p-8 rounded-[32px] border-emerald-500/20 shadow-lg shadow-emerald-950/10 flex flex-col gap-6"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-400">Jogos de Hoje</h4>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
                </span>
              </div>

              {todayMatches.length > 0 ? (
                <div className="flex flex-col gap-8 divide-y divide-slate-800/60">
                  {todayMatches.map((match, idx) => {
                    const guess = todayGuesses[match.id] || { score1: '', score2: '', yellow_cards_winner: '', has_red_card: undefined };
                    const isSaving = savingTodayGuess[match.id] || false;
                    const isSaved = savedTodayGuess[match.id] || false;
                    const isStarted = isMatchStarted(match);
                    const isEnded = match.score1 !== null && match.score2 !== null;

                    return (
                      <div key={match.id} className={`flex flex-col gap-4 ${idx > 0 ? 'pt-8' : ''} ${isEnded ? 'opacity-50 grayscale' : ''}`}>
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-0.5 glass-emerald text-emerald-400 text-[9px] font-black rounded-lg uppercase tracking-widest">
                            {match.round}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            {formatMatchTime(match.time)}
                          </span>
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                          {/* Match Teams and Scores */}
                          <div className="flex items-center gap-2 sm:gap-4 justify-center w-full md:w-auto flex-1">
                            {/* Team A */}
                            <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                              <span className="font-bold text-xs sm:text-sm uppercase truncate text-right">{match.team1}</span>
                              <div className="w-8 h-5 bg-slate-900 rounded-sm overflow-hidden flex-shrink-0 border border-slate-700">
                                <Flag code={getFlagCode(match.team1)} className={`w-full h-full object-cover ${isEnded ? 'grayscale' : ''}`} />
                              </div>
                            </div>

                            {/* Inputs */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <input
                                type="text"
                                value={guess.score1}
                                onChange={(e) => handleTodayScoreChange(match.id, 1, e.target.value)}
                                disabled={isStarted}
                                className="w-10 h-10 bg-slate-900 rounded-lg border border-slate-700 text-center font-bold text-base focus:border-emerald-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="0"
                              />
                              <span className="font-black text-slate-700 italic text-sm">X</span>
                              <input
                                type="text"
                                value={guess.score2}
                                onChange={(e) => handleTodayScoreChange(match.id, 2, e.target.value)}
                                disabled={isStarted}
                                className="w-10 h-10 bg-slate-900 rounded-lg border border-slate-700 text-center font-bold text-base focus:border-emerald-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="0"
                              />
                            </div>

                            {/* Team B */}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="w-8 h-5 bg-slate-900 rounded-sm overflow-hidden flex-shrink-0 border border-slate-700">
                                <Flag code={getFlagCode(match.team2)} className={`w-full h-full object-cover ${isEnded ? 'grayscale' : ''}`} />
                              </div>
                              <span className="font-bold text-xs sm:text-sm uppercase truncate text-left">{match.team2}</span>
                            </div>
                          </div>

                          {/* Save Button for this match */}
                          <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-end">
                            <button
                              onClick={() => handleSaveTodayGuess(match.id)}
                              disabled={!guess.score1 || !guess.score2 || isSaving || isStarted}
                              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all w-full md:w-auto flex items-center justify-center gap-2 ${
                                isSaved
                                  ? 'bg-emerald-500 text-slate-900 shadow-md shadow-emerald-500/10'
                                  : 'bg-slate-900 hover:bg-emerald-500 hover:text-slate-900 border border-slate-800 hover:border-emerald-500 text-slate-400 disabled:opacity-30 disabled:hover:bg-slate-900 disabled:hover:text-slate-400 disabled:hover:border-slate-800'
                              }`}
                            >
                              {isSaving ? <Loader2 size={12} className="animate-spin" /> : isSaved ? <CheckCircle2 size={12} /> : <Save size={12} />}
                              {isSaved ? 'SALVO' : 'SALVAR'}
                            </button>
                          </div>
                        </div>

                        {isEnded && (
                          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-left space-y-2 mt-2 w-full">
                            <div className="flex items-center justify-between border-b border-emerald-500/10 pb-1.5">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Resultado Oficial
                              </span>
                              {guess.points_earned !== undefined && (
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                  +{guess.points_earned} pts
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-[9px] font-bold uppercase tracking-wider text-slate-300">
                              <div className="bg-slate-900/50 p-1.5 rounded-lg border border-slate-800/40">
                                <p className="text-[8px] text-slate-500">Placar</p>
                                <p className="text-white font-black mt-0.5">{match.score1} x {match.score2}</p>
                              </div>
                              <div className="bg-slate-900/50 p-1.5 rounded-lg border border-slate-800/40">
                                <p className="text-[8px] text-slate-500">Mais Amarelos</p>
                                <p className="text-amber-400 font-black mt-0.5 truncate">{match.yellow_cards_winner || '-'}</p>
                              </div>
                              <div className="bg-slate-900/50 p-1.5 rounded-lg border border-slate-800/40">
                                <p className="text-[8px] text-slate-500">Vermelho?</p>
                                <p className="text-emerald-400 font-black mt-0.5">{match.has_red_card === true ? 'SIM' : match.has_red_card === false ? 'NÃO' : '-'}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Extra predictions (Cards) */}
                        <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 space-y-2.5 mt-1">
                          <div className="flex flex-col sm:flex-row gap-4 justify-between">
                            {/* Yellow Cards Winner */}
                            <div className="flex items-center justify-between gap-4 flex-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mais Amarelos (3 pts)</span>
                              <div className="flex gap-0.5 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                                {[
                                  { value: match.team1, label: match.team1.substring(0, 3).toUpperCase() },
                                  { value: 'Empate', label: 'EMP' },
                                  { value: match.team2, label: match.team2.substring(0, 3).toUpperCase() }
                                ].map((opt, optIdx) => (
                                  <button
                                    key={`${opt.value}-${optIdx}`}
                                    type="button"
                                    disabled={isStarted}
                                    onClick={() => handleTodayYellowCardsChange(match.id, opt.value)}
                                    className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${
                                      (guess.yellow_cards_winner && opt.value && normalizeTeamName(guess.yellow_cards_winner) === normalizeTeamName(opt.value))
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
                            <div className="flex items-center justify-between gap-4 flex-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Terá Vermelho? (4 pts)</span>
                              <div className="flex gap-0.5 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                                {[
                                  { value: true, label: 'SIM' },
                                  { value: false, label: 'NÃO' }
                                ].map(opt => (
                                  <button
                                    key={String(opt.value)}
                                    type="button"
                                    disabled={isStarted}
                                    onClick={() => handleTodayRedCardChange(match.id, opt.value)}
                                    className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${
                                      guess.has_red_card === opt.value
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
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2">
                  <Calendar size={32} className="text-slate-600 mb-1" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhum jogo agendado para hoje</p>
                  <Link href="/dashboard/matches" className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest mt-1">
                    Visualizar calendário completo
                  </Link>
                </div>
              )}
            </motion.div>

            {user && <EvolutionChart profileId={user.id} />}

            {/* Split layout: Aproveitamento and Últimos Jogos */}
            {user && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Taxa de Acerto */}
                <div className="glass p-6 md:p-8 rounded-[32px] flex flex-col justify-between gap-6 border-slate-800/80">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
                      <Target size={16} /> Taxa de Acerto e Rendimento
                    </h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                      Seu aproveitamento com base em jogos finalizados
                    </p>
                  </div>

                  <div className="flex items-center justify-around gap-4">
                    {/* Circle yield indicator */}
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          className="stroke-slate-800"
                          strokeWidth="10"
                          fill="transparent"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          className="stroke-emerald-500 transition-all duration-1000 ease-out"
                          strokeWidth="10"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 40}
                          strokeDashoffset={2 * Math.PI * 40 * (1 - accuracyStats.rate / 100)}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-2xl font-black text-white">{accuracyStats.rate}%</span>
                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">APROVEIT.</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                        <span className="font-bold text-slate-400">Cheios:</span>
                        <span className="font-black text-white">{accuracyStats.exact}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500" />
                        <span className="font-bold text-slate-400">Resultados:</span>
                        <span className="font-black text-white">{accuracyStats.outcome}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                        <span className="font-bold text-slate-400">Erros:</span>
                        <span className="font-black text-white">{accuracyStats.errors}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800/80 flex items-center justify-between text-center">
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total Palpitado</p>
                      <p className="text-lg font-black text-white mt-0.5">{accuracyStats.total}</p>
                    </div>
                    <div className="w-px h-8 bg-slate-800" />
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Acertos</p>
                      <p className="text-lg font-black text-emerald-400 mt-0.5">{accuracyStats.exact + accuracyStats.outcome}</p>
                    </div>
                    <div className="w-px h-8 bg-slate-800" />
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Rendimento</p>
                      <p className="text-lg font-black text-cyan-400 mt-0.5">
                        {accuracyStats.total > 0 ? Math.round(((accuracyStats.exact * 3 + accuracyStats.outcome * 1) / (accuracyStats.total * 3)) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Meus Últimos Jogos */}
                <div className="glass p-6 md:p-8 rounded-[32px] flex flex-col justify-between gap-6 border-slate-800/80">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
                      <History size={16} /> Meus Últimos Jogos
                    </h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                      Histórico recente de palpites pontuados
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 flex-1 justify-center">
                    {recentHistory.length > 0 ? (
                      recentHistory.map((m: any) => {
                        const isExact = m.guess && m.score1 === m.guess.score1 && m.score2 === m.guess.score2;
                        const isOutcome = m.guess && !isExact && Math.sign(m.score1 - m.score2) === Math.sign(m.guess.score1 - m.guess.score2);
                        
                        return (
                          <div key={m.id} className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-xl flex items-center justify-between gap-4">
                            {/* Match teams and scores */}
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="flex items-center gap-2 justify-between">
                                <span className="text-[11px] font-bold text-slate-300 truncate max-w-[80px]">{m.team1}</span>
                                <span className="text-xs font-black text-white">{m.score1} - {m.score2}</span>
                                <span className="text-[11px] font-bold text-slate-300 truncate max-w-[80px] text-right">{m.team2}</span>
                              </div>
                              <div className="flex items-center justify-between text-[9px] font-medium text-slate-500">
                                <span>Meu palpite: <strong className="text-slate-400">{m.guess?.score1} x {m.guess?.score2}</strong></span>
                              </div>
                            </div>

                            {/* Badge with point feedback */}
                            <div className="flex-shrink-0 text-right">
                              <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                isExact 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                                  : isOutcome 
                                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              }`}>
                                +{m.guess?.points_earned || 0} pts
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center border border-dashed border-slate-800 rounded-2xl">
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Nenhum palpite pontuado ainda</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {user && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Minhas Conquistas</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Medalhas virtuais desbloqueadas de acordo com seu desempenho</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {BADGES_DEFINITION.map(badge => {
                    const earnedList = calculateUserBadges(userGuesses, rankingPosition, userGroupPredictions, groupResults);
                    const isEarned = earnedList.includes(badge.id);
                    return (
                      <div 
                        key={badge.id}
                        className={`glass p-5 rounded-2xl flex flex-col items-center text-center justify-between border transition-all duration-300 relative overflow-hidden ${
                          isEarned 
                            ? `${badge.color} shadow-lg ${badge.glowColor} scale-100` 
                            : 'border-slate-800/80 text-slate-600 opacity-40 grayscale scale-95'
                        }`}
                        title={badge.description}
                      >
                        <div className="text-3xl mb-3">{badge.icon}</div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-100">{badge.name}</p>
                          <p className="text-[8px] font-bold text-slate-500 mt-1 line-clamp-2 leading-relaxed">{badge.description}</p>
                        </div>
                        {!isEarned && (
                          <div className="absolute top-2 right-2 text-[9px] font-black tracking-widest text-slate-600">🔒</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
 
          {/* Sidebar */}
          <div className="flex flex-col gap-8">
            <section className="glass p-8 rounded-[32px]">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-3">
                <Trophy size={18} className="text-amber-500" /> OS 3 MELHORES
              </h3>
              <div className="flex flex-col gap-4">
                {top3Profiles.length > 0 ? (
                  top3Profiles.map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/50 border border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-slate-950 ${
                          idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-300' : 'bg-amber-700 text-slate-200'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center font-black text-emerald-400 uppercase overflow-hidden">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            p.full_name?.charAt(0) || p.username?.charAt(0) || '?'
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-black text-white">{p.full_name || p.username}</p>
                          {p.username && <p className="text-[9px] font-bold text-slate-500">@{p.username}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-emerald-400">{p.points || 0} pts</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed">Nenhum usuário no ranking ainda</p>
                  </div>
                )}
                <Link href="/dashboard/ranking" className="mt-6 text-center text-[10px] font-bold text-slate-500 hover:text-emerald-400 uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-1">
                  Ver Ranking Completo <ChevronRight size={12} />
                </Link>
              </div>
            </section>
 
            <section className="glass p-8 rounded-[32px] flex flex-col gap-6">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                <Calendar size={18} className="text-emerald-400" /> PRÓXIMOS 3 DIAS
              </h3>
              
              <div className="flex flex-col gap-4">
                {next3DaysMatches.length > 0 ? (
                  next3DaysMatches.map((match) => (
                    <div key={match.id} className="p-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
                        <span>{formatMatchDate(match.date)}</span>
                        <span>{formatMatchTime(match.time)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-6 h-4 bg-slate-950 rounded-sm overflow-hidden border border-slate-800 flex-shrink-0">
                            <Flag code={getFlagCode(match.team1)} className="w-full h-full object-cover" />
                          </div>
                          <span className="text-xs font-black text-slate-200 truncate">{match.team1}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-600 italic">VS</span>
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          <span className="text-xs font-black text-slate-200 truncate text-right">{match.team2}</span>
                          <div className="w-6 h-4 bg-slate-950 rounded-sm overflow-hidden border border-slate-800 flex-shrink-0">
                            <Flag code={getFlagCode(match.team2)} className="w-full h-full object-cover" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center border border-dashed border-slate-800 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed">Nenhum jogo nos próximos 3 dias</p>
                  </div>
                )}
              </div>
 
              <Link href="/dashboard/matches" className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/15 flex items-center justify-center gap-2">
                + PARTIDAS
              </Link>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
