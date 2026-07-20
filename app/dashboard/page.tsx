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

const calculateGroupPoints = (pred: any, result: any) => {
  if (!result || !result.first_place || !result.second_place) return 0;
  let pts = 0;

  const pFirst = pred?.first_place;
  const pSecond = pred?.second_place;
  const pThird = pred?.third_place;
  const pThirdQual = pred?.third_place_qualified || false;

  const rFirst = result.first_place;
  const rSecond = result.second_place;
  const rThird = result.third_place;
  const rThirdQual = result.third_place_qualified || false;

  if (pFirst === rFirst && pSecond === rSecond) {
    pts += 5;
  } else if (pFirst === rFirst) {
    pts += 3;
  } else if (pSecond === rSecond) {
    pts += 2;
  }

  if (pThirdQual && rThirdQual && pThird === rThird) {
    pts += 1;
  }

  return pts;
};

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([
    { label: 'Pontos Totais', value: '0', icon: Star, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Pontos de Hoje', value: '0 pts', icon: Calendar, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Pontos de Classificação', value: '0 pts', icon: Target, color: 'text-pink-400', bg: 'bg-pink-400/10' },
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

  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [allTournamentPredictions, setAllTournamentPredictions] = useState<any[]>([]);
  const [tournamentResults, setTournamentResults] = useState<any>(null);
  const [searchPreds, setSearchPreds] = useState<string>('');
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({
    todayMatches: true,
    evolutionChart: true,
    knockoutDetails: true,
    tournamentPredictions: true,
    top3: true,
    nextMatches: true,
    accuracyStats: true,
    recentGuesses: true,
    groupPredictions: true,
  });

  const toggleCardCollapse = (cardId: string) => {
    setCollapsedCards(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  const collapseAllCards = (collapse: boolean) => {
    const cardIds = [
      'todayMatches',
      'evolutionChart',
      'knockoutDetails',
      'tournamentPredictions',
      'top3',
      'nextMatches',
      'accuracyStats',
      'recentGuesses',
      'groupPredictions'
    ];
    const newState: Record<string, boolean> = {};
    cardIds.forEach(id => {
      newState[id] = collapse;
    });
    setCollapsedCards(newState);
  };
  // Today's matches states
  const [todayMatches, setTodayMatches] = useState<any[]>([]);
  const [todayGuesses, setTodayGuesses] = useState<Record<string, { score1: string, score2: string, yellow_cards_winner?: string, has_red_card?: boolean, points_earned?: number }>>({});
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

  // Knockout/Group Sweepstakes states
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedGroupDetails, setSelectedGroupDetails] = useState<any>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [groupGuesses, setGroupGuesses] = useState<any[]>([]);
  const [loadingKnockout, setLoadingKnockout] = useState(false);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});

  const filteredProfilesForPreds = React.useMemo(() => {
    return allProfiles.filter(p => {
      const name = (p.full_name || '').toLowerCase();
      const username = (p.username || '').toLowerCase();
      const query = searchPreds.toLowerCase();
      return name.includes(query) || username.includes(query);
    });
  }, [allProfiles, searchPreds]);

  const renderPredCell = (predVal: string | undefined | null, resultVal: string | undefined | null, points: number, isSubstringMatch = false) => {
    if (!predVal) return <span className="text-slate-600 italic">Pendente</span>;
    if (!resultVal) return <span className="text-slate-300 font-bold uppercase">{predVal}</span>;
    
    let isMatch = false;
    if (isSubstringMatch) {
      const normalize = (str: string) => 
        str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const normPred = normalize(predVal);
      const normResult = normalize(resultVal);
      isMatch = normPred !== '' && normResult !== '' && (normPred.includes(normResult) || normResult.includes(normPred));
    } else {
      isMatch = predVal.trim().toLowerCase() === resultVal.trim().toLowerCase();
    }

    return (
      <div className="flex flex-col">
        <span className={`font-black uppercase tracking-tight ${isMatch ? 'text-emerald-400' : 'text-rose-500/80'}`}>
          {predVal}
        </span>
        <span className={`text-[8px] font-black uppercase tracking-wide mt-0.5 ${isMatch ? 'text-emerald-500/80' : 'text-rose-600/70'}`}>
          {isMatch ? `+${points} pts ✓` : '0 pts ✗'}
        </span>
      </div>
    );
  };

  const toggleStageCollapse = (stage: string) => {
    setCollapsedStages(prev => ({ ...prev, [stage]: !prev[stage] }));
  };

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

          // Buscar todos os dados do banco de dados em paralelo para evitar gargalos/waterfall
          const [
            profileRes,
            guessesRes,
            top3Res,
            groupPredsRes,
            resultsRes,
            userGroupsRes,
            allProfilesRes,
            allPredsRes,
            tResultsRes,
            matchesRes
          ] = await Promise.all([
            supabase.from('profiles').select('full_name, points, ranking_position').eq('id', currentUser.id).single(),
            supabase.from('guesses').select('id, match_id, score1, score2, points_earned, yellow_cards_winner, has_red_card').eq('profile_id', currentUser.id),
            supabase.from('profiles').select('id, full_name, points, avatar_url, username').order('points', { ascending: false }).limit(3),
            supabase.from('group_predictions').select('*').eq('profile_id', currentUser.id),
            supabase.from('group_results').select('*'),
            supabase.from('group_members').select('group_id, groups(*)').eq('profile_id', currentUser.id),
            supabase.from('profiles').select('id, full_name, username, avatar_url, points').order('points', { ascending: false }),
            supabase.from('tournament_predictions').select('*'),
            supabase.from('tournament_results').select('*').eq('id', 1).maybeSingle(),
            supabase.from('matches').select('*').order('date', { ascending: true }).order('time', { ascending: true })
          ]);

          const profile = profileRes.data;
          const guessesData = guessesRes.data;
          const top3Data = top3Res.data;
          const groupPreds = groupPredsRes.data;
          const resultsData = resultsRes.data;
          const userGroupsData = userGroupsRes.data;
          const allProfilesData = allProfilesRes.data;
          const allPredsData = allPredsRes.data;
          const tResults = tResultsRes.data;
          const matches = matchesRes.data;

          if (profile) {
            setProfileName(profile.full_name || currentUser.email?.split('@')[0] || '');
          }

          if (guessesData) {
            loadedGuesses = guessesData;
            setUserGuesses(guessesData);
          }

          if (top3Data) {
            setTop3Profiles(top3Data);
          }

          if (groupPreds) {
            setUserGroupPredictions(groupPreds);
          }

          if (resultsData) {
            setGroupResults(resultsData);
          }

          if (userGroupsData && userGroupsData.length > 0) {
            const processedGroups = userGroupsData.map((ug: any) => ug.groups).filter(Boolean);
            setUserGroups(processedGroups);
            setSelectedGroupId(processedGroups[0].id);
          }

          if (allProfilesData) {
            setAllProfiles(allProfilesData);
            
            // Calcular posição de ranking dinamicamente a partir dos perfis carregados (evita query extra)
            const userIndex = allProfilesData.findIndex((p: any) => p.id === currentUser.id);
            const computedRank = userIndex !== -1 ? userIndex + 1 : 1;
            setRankingPosition(computedRank);
          }

          if (allPredsData) {
            setAllTournamentPredictions(allPredsData);
          }

          if (tResults) {
            setTournamentResults(tResults);
          }

          // Update initial stats
          const totalPoints = profile?.points || 0;
          const matchGuessesPoints = guessesData ? guessesData.reduce((acc: number, curr: any) => acc + (curr.points_earned || 0), 0) : 0;
          const classificationPoints = Math.max(0, totalPoints - matchGuessesPoints);

          // Calcular posição de ranking final
          const userIndex = allProfilesData ? allProfilesData.findIndex((p: any) => p.id === currentUser.id) : -1;
          const computedRank = userIndex !== -1 ? userIndex + 1 : 1;

          setStats([
            { label: 'Pontos Totais', value: String(totalPoints), icon: Star, color: 'text-amber-400', bg: 'bg-amber-400/10' },
            { label: 'Pontos de Hoje', value: '0 pts', icon: Calendar, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Pontos de Classificação', value: `${classificationPoints} pts`, icon: Target, color: 'text-pink-400', bg: 'bg-pink-400/10' },
            { label: 'Posição no Ranking', value: `${computedRank}º`, icon: Trophy, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
          ]);
        } else {
          router.push('/login');
          return;
        }

        const rawMatches = (matchesRes.data && matchesRes.data.length > 0) ? matchesRes.data : WORLD_CUP_DATA.matches;
        loadedMatches = mapMatchesToBrazil(rawMatches);
        setAllMatches(loadedMatches);

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

  useEffect(() => {
    const fetchGroupData = async () => {
      if (!selectedGroupId || allMatches.length === 0) return;
      setLoadingKnockout(true);
      try {
        // Fetch group details to get score rules
        const { data: groupData } = await supabase
          .from('groups')
          .select('*')
          .eq('id', selectedGroupId)
          .single();
        setSelectedGroupDetails(groupData);

        // Fetch members of this group
        const { data: membersData } = await supabase
          .from('group_members')
          .select('profile_id, profiles(*)')
          .eq('group_id', selectedGroupId);

        if (membersData) {
          const members = membersData.map((m: any) => m.profiles).filter(Boolean);
          setGroupMembers(members);

          // Get finished knockout matches
          const finishedKnockoutIds = allMatches
            .filter((m: any) => !m.group && m.score1 !== null && m.score2 !== null)
            .map((m: any) => m.id);

          if (finishedKnockoutIds.length > 0) {
            const memberIds = members.map((m: any) => m.id);
            // Fetch guesses for these matches by these members
            const { data: guessesData } = await supabase
              .from('guesses')
              .select('*')
              .in('profile_id', memberIds)
              .in('match_id', finishedKnockoutIds);

            setGroupGuesses(guessesData || []);
          } else {
            setGroupGuesses([]);
          }
        }
      } catch (err) {
        console.error("Error fetching group knockout data:", err);
      } finally {
        setLoadingKnockout(false);
      }
    };

    fetchGroupData();
  }, [selectedGroupId, allMatches]);

  const getPointsBreakdown = (guess: any, match: any, rules: any) => {
    if (!guess || match.score1 === null || match.score2 === null) return [];

    const ptsWinner = rules?.points_winner ?? 2; // Default from create group is 2
    const ptsExact = rules?.points_exact ?? 5;
    const ptsYellow = rules?.points_yellow_cards ?? 3;
    const ptsRed = rules?.points_red_card ?? 4;

    const breakdown = [];

    // Exact score
    const isExact = match.score1 === guess.score1 && match.score2 === guess.score2;
    // Outcome
    const isOutcome = !isExact && (Math.sign(match.score1 - match.score2) === Math.sign(guess.score1 - guess.score2));

    if (isExact) {
      breakdown.push({ label: 'Placar Exato', points: ptsExact, type: 'exact' });
    } else if (isOutcome) {
      breakdown.push({ label: 'Resultado', points: ptsWinner, type: 'winner' });
    }

    // Yellow Cards
    if (match.yellow_cards_winner && guess.yellow_cards_winner && normalizeTeamName(match.yellow_cards_winner) === normalizeTeamName(guess.yellow_cards_winner)) {
      breakdown.push({ label: 'Mais Amarelos', points: ptsYellow, type: 'yellow' });
    }

    // Red Card
    if (match.has_red_card !== null && guess.has_red_card !== null && match.has_red_card === guess.has_red_card) {
      breakdown.push({ label: 'Cartão Vermelho', points: ptsRed, type: 'red' });
    }

    return breakdown;
  };

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
            <h1 className="text-5xl md:text-4xl font-black tracking-tighter">
              Olá, <span className="gradient-text">{profileName}</span>!
            </h1>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => collapseAllCards(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-slate-800"
            >
              Minimizar Todos
            </button>
            <button
              onClick={() => collapseAllCards(false)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-slate-800"
            >
              Expandir Todos
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Main Feed */}
          <div className="flex flex-col gap-8">
            {/* Palpites dos Jogos de Hoje */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass p-6 md:p-8 rounded-[32px] border-emerald-500/20 shadow-lg shadow-emerald-950/10 flex flex-col ${collapsedCards['todayMatches'] ? '' : 'gap-6'}`}
            >
              <div className={`flex items-center justify-between ${collapsedCards['todayMatches'] ? '' : 'border-b border-slate-800 pb-4'}`}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Jogos de Hoje</h4>
                </div>
                <div className="flex items-center gap-4">
                  {!collapsedCards['todayMatches'] && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
                    </span>
                  )}
                  <button
                    onClick={() => toggleCardCollapse('todayMatches')}
                    className="text-[10px] font-black text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest"
                  >
                    {collapsedCards['todayMatches'] ? 'Expandir ▾' : 'Minimizar ▴'}
                  </button>
                </div>
              </div>

              {!collapsedCards['todayMatches'] && (
                todayMatches.length > 0 ? (
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
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all w-full md:w-auto flex items-center justify-center gap-2 ${isSaved
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
                                      className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${(guess.yellow_cards_winner && opt.value && normalizeTeamName(guess.yellow_cards_winner) === normalizeTeamName(opt.value))
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
                                      className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${guess.has_red_card === opt.value
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
                )
              )}
            </motion.div>

            {user && (
              <div className="glass p-6 md:p-8 rounded-[32px] border-slate-800/80">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
                    <History size={16} /> Evolução de Pontos
                  </h4>
                  <button
                    onClick={() => toggleCardCollapse('evolutionChart')}
                    className="text-[10px] font-black text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest"
                  >
                    {collapsedCards['evolutionChart'] ? 'Expandir ▾' : 'Minimizar ▴'}
                  </button>
                </div>
                {!collapsedCards['evolutionChart'] && (
                  <div className="mt-6">
                    <EvolutionChart profileId={user.id} />
                  </div>
                )}
              </div>
            )}



            {/* Seção Mata-Mata e Pontos do Bolão */}
            {user && (
              <div className="glass p-6 md:p-8 rounded-[32px] border-slate-800/80">
                <div className={`flex items-center justify-between ${collapsedCards['knockoutDetails'] ? '' : 'mb-6'}`}>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
                      <Trophy size={16} /> Detalhamento do Mata-Mata
                    </h4>
                    {!collapsedCards['knockoutDetails'] && (
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                        Jogos pós-fase de grupos e pontos ganhos por participante do bolão
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {!collapsedCards['knockoutDetails'] && userGroups.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Bolão:</span>
                        <select
                          value={selectedGroupId}
                          onChange={(e) => setSelectedGroupId(e.target.value)}
                          className="bg-slate-900 border border-slate-800 text-xs font-bold text-white rounded-lg px-3 py-1.5 focus:border-emerald-500 outline-none cursor-pointer"
                        >
                          {userGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button
                      onClick={() => toggleCardCollapse('knockoutDetails')}
                      className="text-[10px] font-black text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest"
                    >
                      {collapsedCards['knockoutDetails'] ? 'Expandir ▾' : 'Minimizar ▴'}
                    </button>
                  </div>
                </div>

                {!collapsedCards['knockoutDetails'] && (
                  userGroups.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2">
                      <Users size={32} className="text-slate-600 mb-1" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Você não faz parte de nenhum bolão</p>
                      <Link href="/dashboard/groups" className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest mt-1">
                        Participar ou criar um bolão
                      </Link>
                    </div>
                  ) : loadingKnockout ? (
                    <div className="py-12 flex flex-col items-center justify-center">
                      <Loader2 size={32} className="animate-spin text-emerald-500 mb-2" />
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Carregando dados do bolão...</p>
                    </div>
                  ) : (
                    (() => {
                      const knockoutMatches = allMatches.filter((m: any) => !m.group && m.score1 !== null && m.score2 !== null);

                      if (knockoutMatches.length === 0) {
                        return (
                          <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2">
                            <Trophy size={32} className="text-slate-600 mb-1" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhuma partida do mata-mata concluída ainda</p>
                            <p className="text-[9px] text-slate-500 font-bold uppercase">As estatísticas aparecerão assim que os jogos do mata-mata forem finalizados.</p>
                          </div>
                        );
                      }

                      // Group by stage (round)
                      const stages: Record<string, any[]> = {};
                      knockoutMatches.forEach((match) => {
                        const round = match.round || 'Outro';
                        if (!stages[round]) stages[round] = [];
                        stages[round].push(match);
                      });

                      // Order of stages to display them logically
                      const stageOrder = ["16-avos de final", "Oitavas de final", "Quartas de final", "Semi-final", "Disputa pelo 3º Lugar", "Final"];
                      const sortedStages = Object.keys(stages).sort((a, b) => {
                        const idxA = stageOrder.indexOf(a);
                        const idxB = stageOrder.indexOf(b);
                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                        return a.localeCompare(b);
                      });

                      return (
                        <div className="space-y-6">
                          {sortedStages.map((stage) => {
                            const isCollapsed = collapsedStages[stage] ?? false;
                            const stageMatches = stages[stage];

                            return (
                              <div key={stage} className="border border-slate-800/80 rounded-[24px] overflow-hidden bg-slate-900/10">
                                <button
                                  onClick={() => toggleStageCollapse(stage)}
                                  className="w-full flex items-center justify-between p-4 bg-slate-900/30 hover:bg-slate-900/50 transition-colors text-left border-b border-slate-800/40"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">
                                      {stage}
                                    </span>
                                    <span className="px-2.5 py-0.5 bg-slate-900/80 text-[9px] font-bold text-slate-400 rounded-md border border-slate-800/60">
                                      {stageMatches.length} {stageMatches.length === 1 ? 'jogo' : 'jogos'}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-black text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest flex items-center gap-1">
                                    {isCollapsed ? 'Expandir ▾' : 'Minimizar ▴'}
                                  </span>
                                </button>

                                {!isCollapsed && (
                                  <div className="p-4 space-y-4 bg-slate-950/10">
                                    {stageMatches.map((match) => (
                                      <div key={match.id} className="p-5 bg-slate-900/20 border border-slate-800/40 rounded-2xl flex flex-col gap-4">
                                        {/* Match Header info */}
                                        <div className="flex flex-col sm:flex-row items-center justify-between pb-3 border-b border-slate-800/40 gap-3">
                                          <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black rounded-lg uppercase tracking-wider">
                                            {match.round}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-xs uppercase text-slate-200">{match.team1}</span>
                                            <div className="w-6 h-4 bg-slate-950 rounded-sm overflow-hidden border border-slate-800">
                                              <Flag code={getFlagCode(match.team1)} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="font-black text-sm text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{match.score1} - {match.score2}</span>
                                            <div className="w-6 h-4 bg-slate-950 rounded-sm overflow-hidden border border-slate-800">
                                              <Flag code={getFlagCode(match.team2)} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="font-bold text-xs uppercase text-slate-200">{match.team2}</span>
                                          </div>
                                          <div className="flex items-center gap-3 text-[9px] text-slate-400 uppercase font-bold">
                                            {match.yellow_cards_winner && (
                                              <span className="flex items-center gap-1">
                                                🟨 <strong className="text-amber-400">{match.yellow_cards_winner === 'Empate' ? 'EMP' : match.yellow_cards_winner}</strong>
                                              </span>
                                            )}
                                            {match.has_red_card !== null && (
                                              <span className="flex items-center gap-1">
                                                🟥 <strong className="text-rose-500">{match.has_red_card ? 'SIM' : 'NÃO'}</strong>
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Participants guesses & points breakdown */}
                                        <div className="space-y-3">
                                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Palpites e Pontuação dos Participantes:</p>

                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {groupMembers.map((member) => {
                                              const guess = groupGuesses.find((g) => g.profile_id === member.id && g.match_id === match.id);
                                              const breakdown = getPointsBreakdown(guess, match, selectedGroupDetails);
                                              const totalPts = guess ? (guess.points_earned || 0) : 0;

                                              return (
                                                <div key={member.id} className="p-3 bg-slate-950/40 border border-slate-800/40 rounded-xl flex items-center justify-between gap-3">
                                                  <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-black text-emerald-400 uppercase overflow-hidden shrink-0">
                                                      {member.avatar_url ? (
                                                        <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                                                      ) : (
                                                        member.full_name?.charAt(0) || '?'
                                                      )}
                                                    </div>
                                                    <div className="min-w-0">
                                                      <p className="text-xs font-black text-white truncate">{member.full_name || member.username || 'Membro'}</p>
                                                      {guess ? (
                                                        <div className="text-[9px] text-slate-400 font-medium">
                                                          Palpite: <strong className="text-slate-200">{guess.score1} x {guess.score2}</strong>
                                                          {guess.yellow_cards_winner && (
                                                            <span className="ml-1 text-[8px] text-amber-500 bg-amber-500/10 px-1 py-0.2 rounded font-black">
                                                              🟨 {guess.yellow_cards_winner === 'Empate' ? 'EMP' : guess.yellow_cards_winner.substring(0, 3).toUpperCase()}
                                                            </span>
                                                          )}
                                                          {guess.has_red_card !== null && (
                                                            <span className="ml-1 text-[8px] text-rose-500 bg-rose-500/10 px-1 py-0.2 rounded font-black">
                                                              🟥 {guess.has_red_card ? 'SIM' : 'NÃO'}
                                                            </span>
                                                          )}
                                                        </div>
                                                      ) : (
                                                        <p className="text-[9px] text-rose-500/70 italic font-bold uppercase">Sem palpite</p>
                                                      )}
                                                    </div>
                                                  </div>

                                                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${totalPts > 0
                                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                      : 'bg-slate-900/60 text-slate-500 border border-slate-800'
                                                      }`}>
                                                      +{totalPts} pts
                                                    </span>
                                                    {breakdown.length > 0 && (
                                                      <div className="flex flex-wrap gap-1 justify-end max-w-[150px]">
                                                        {breakdown.map((item, bIdx) => (
                                                          <span
                                                            key={bIdx}
                                                            className={`text-[7px] font-bold px-1.5 py-0.2 rounded uppercase ${item.type === 'exact'
                                                              ? 'bg-emerald-500/20 text-emerald-300'
                                                              : item.type === 'winner'
                                                                ? 'bg-cyan-500/20 text-cyan-300'
                                                                : item.type === 'yellow'
                                                                  ? 'bg-amber-500/20 text-amber-300'
                                                                  : 'bg-rose-500/20 text-rose-300'
                                                              }`}
                                                            title={`${item.label}: +${item.points} pts`}
                                                          >
                                                            {item.label.split(' ')[0]} (+{item.points})
                                                          </span>
                                                        ))}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  ))}
              </div>
            )}



            {/* Palpites do Torneio (Final e Extras) de Todos os Participantes */}
            {user && (
              <div className="glass p-6 md:p-8 rounded-[32px] border-slate-800/80">
                <div className={`flex items-center justify-between ${collapsedCards['tournamentPredictions'] ? '' : 'mb-6'}`}>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
                      <Trophy size={16} /> Palpites Finais e Extras (Todos os Usuários)
                    </h4>
                    {!collapsedCards['tournamentPredictions'] && (
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                        Veja as previsões do torneio e as escolhas extras feitas por todos os participantes
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {!collapsedCards['tournamentPredictions'] && (
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="BUSCAR PARTICIPANTE..."
                          value={searchPreds}
                          onChange={(e) => setSearchPreds(e.target.value)}
                          className="pl-4 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold focus:border-emerald-500 outline-none transition-all uppercase tracking-widest text-white w-full sm:w-60"
                        />
                      </div>
                    )}
                    <button
                      onClick={() => toggleCardCollapse('tournamentPredictions')}
                      className="text-[10px] font-black text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest"
                    >
                      {collapsedCards['tournamentPredictions'] ? 'Expandir ▾' : 'Minimizar ▴'}
                    </button>
                  </div>
                </div>

                {!collapsedCards['tournamentPredictions'] && (
                  <div className="overflow-x-auto w-full border border-slate-800/80 rounded-2xl bg-slate-950/10">
                    <table className="w-full text-[10px] text-left border-collapse min-w-[900px]">
                      <thead>
                        <tr className="border-b border-slate-800/80 bg-slate-900/30 text-slate-400 font-bold uppercase tracking-wider">
                          <th className="py-4 px-4 font-black">Participante</th>
                          <th className="py-4 px-4 font-black text-amber-400">🥇 Campeão</th>
                          <th className="py-4 px-4 font-black text-slate-300">🥈 2º Lugar</th>
                          <th className="py-4 px-4 font-black text-amber-700">🥉 3º Lugar</th>
                          <th className="py-4 px-4 font-black text-cyan-400">🌟 Craque</th>
                          <th className="py-4 px-4 font-black text-emerald-400">⚽ Artilheiro</th>
                          <th className="py-4 px-4 font-black text-pink-400">🔥 Atq.</th>
                          <th className="py-4 px-4 font-black text-purple-400">🛡️ Def.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {filteredProfilesForPreds.map((p) => {
                          const pred = allTournamentPredictions.find(tp => tp.profile_id === p.id);
                          return (
                            <tr key={p.id} className="hover:bg-slate-900/30 transition-colors">
                              {/* User Info */}
                              <td className="py-4 px-4 font-bold flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-black text-[10px] text-emerald-400 uppercase overflow-hidden shrink-0">
                                  {p.avatar_url ? (
                                    <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    p.full_name?.charAt(0) || '?'
                                  )}
                                </div>
                                <span className="truncate max-w-[120px]" title={p.full_name}>
                                  {p.full_name || p.username || 'Membro'}
                                </span>
                              </td>

                              {/* Champion */}
                              <td className="py-4 px-4 font-medium">
                                {pred ? renderPredCell(pred.champion, tournamentResults?.champion, 15) : <span className="text-slate-700 italic">Pendente</span>}
                              </td>

                              {/* Runner-up */}
                              <td className="py-4 px-4 font-medium">
                                {pred ? renderPredCell(pred.second_place, tournamentResults?.second_place, 12) : <span className="text-slate-700 italic">Pendente</span>}
                              </td>

                              {/* 3rd place */}
                              <td className="py-4 px-4 font-medium">
                                {pred ? renderPredCell(pred.third_place, tournamentResults?.third_place, 10) : <span className="text-slate-700 italic">Pendente</span>}
                              </td>

                              {/* Craque */}
                              <td className="py-4 px-4 font-medium">
                                {pred ? renderPredCell(pred.craque, tournamentResults?.craque, 10, true) : <span className="text-slate-700 italic">Pendente</span>}
                              </td>

                              {/* Artilheiro */}
                              <td className="py-4 px-4 font-medium">
                                {pred ? renderPredCell(pred.artilheiro, tournamentResults?.artilheiro, 8, true) : <span className="text-slate-700 italic">Pendente</span>}
                              </td>

                              {/* Best Attack */}
                              <td className="py-4 px-4 font-medium">
                                {pred ? renderPredCell(pred.best_attack, tournamentResults?.best_attack, 6) : <span className="text-slate-700 italic">Pendente</span>}
                              </td>

                              {/* Best Defense */}
                              <td className="py-4 px-4 font-medium">
                                {pred ? renderPredCell(pred.best_defense, tournamentResults?.best_defense, 6) : <span className="text-slate-700 italic">Pendente</span>}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredProfilesForPreds.length === 0 && (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-600 font-bold uppercase tracking-widest">
                              Nenhum participante encontrado
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-8">
            <section className="glass p-6 md:p-8 rounded-[32px]">
              <div className={`flex items-center justify-between ${collapsedCards['top3'] ? '' : 'mb-6'}`}>
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
                  <Trophy size={16} className="text-amber-500" /> OS 3 MELHORES
                </h4>
                <button
                  onClick={() => toggleCardCollapse('top3')}
                  className="text-[10px] font-black text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest"
                >
                  {collapsedCards['top3'] ? 'Expandir ▾' : 'Minimizar ▴'}
                </button>
              </div>
              {!collapsedCards['top3'] && (
                <div className="flex flex-col gap-4">
                  {top3Profiles.length > 0 ? (
                    top3Profiles.map((p, idx) => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/50 border border-slate-800/80">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-slate-950 ${idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-300' : 'bg-amber-700 text-slate-200'
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
              )}
            </section>

            <section className={`glass p-6 md:p-8 rounded-[32px] flex flex-col ${collapsedCards['nextMatches'] ? '' : 'gap-6'}`}>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
                  <Calendar size={16} className="text-emerald-400" /> PRÓXIMOS 3 DIAS
                </h4>
                <button
                  onClick={() => toggleCardCollapse('nextMatches')}
                  className="text-[10px] font-black text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest"
                >
                  {collapsedCards['nextMatches'] ? 'Expandir ▾' : 'Minimizar ▴'}
                </button>
              </div>

              {!collapsedCards['nextMatches'] && (
                <>
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
                </>
              )}
            </section>

            {/* Taxa de Acerto e Rendimento */}
            {user && (
              <div className={`glass p-6 md:p-8 rounded-[32px] flex flex-col ${collapsedCards['accuracyStats'] ? '' : 'gap-6'} border-slate-800/80`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
                      <Target size={16} /> Taxa de Acerto e Rendimento
                    </h4>
                    {!collapsedCards['accuracyStats'] && (
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                        Seu aproveitamento com base em jogos finalizados
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleCardCollapse('accuracyStats')}
                    className="text-[10px] font-black text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest shrink-0"
                  >
                    {collapsedCards['accuracyStats'] ? 'Expandir ▾' : 'Minimizar ▴'}
                  </button>
                </div>

                {!collapsedCards['accuracyStats'] && (
                  <>
                    <div className="flex items-center justify-around gap-4">
                      {/* Circle yield indicator */}
                      <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
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
                  </>
                )}
              </div>
            )}

            {/* Meus Últimos Jogos */}
            {user && (
              <div className={`glass p-6 md:p-8 rounded-[32px] flex flex-col ${collapsedCards['recentGuesses'] ? '' : 'gap-6'} border-slate-800/80`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
                      <History size={16} /> Meus Últimos Jogos
                    </h4>
                    {!collapsedCards['recentGuesses'] && (
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                        Histórico recente de palpites pontuados
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleCardCollapse('recentGuesses')}
                    className="text-[10px] font-black text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest"
                  >
                    {collapsedCards['recentGuesses'] ? 'Expandir ▾' : 'Minimizar ▴'}
                  </button>
                </div>

                {!collapsedCards['recentGuesses'] && (
                  <div className="flex flex-col gap-3 justify-center">
                    {recentHistory.length > 0 ? (
                      recentHistory.map((m: any) => {
                        const isExact = m.guess && m.score1 === m.guess.score1 && m.score2 === m.guess.score2;
                        const isOutcome = m.guess && !isExact && Math.sign(m.score1 - m.score2) === Math.sign(m.guess.score1 - m.guess.score2);

                        return (
                          <div key={m.id} className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-xl flex items-center justify-between gap-4">
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

                            <div className="flex-shrink-0 text-right">
                              <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${isExact
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
                )}
              </div>
            )}

            {/* Palpites de Grupo */}
            {user && (
              <div className="glass p-6 md:p-8 rounded-[32px] border-slate-800/80">
                <div className={`flex items-center justify-between ${collapsedCards['groupPredictions'] ? '' : 'mb-6'}`}>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
                      <Target size={16} /> Palpites de Grupo
                    </h4>
                    {!collapsedCards['groupPredictions'] && (
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                        Classificação prevista dos grupos
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleCardCollapse('groupPredictions')}
                      className="text-[10px] font-black text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest"
                    >
                      {collapsedCards['groupPredictions'] ? 'Expandir ▾' : 'Minimizar ▴'}
                    </button>
                  </div>
                </div>

                {!collapsedCards['groupPredictions'] && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                    {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map(groupLetter => {
                      const pred = userGroupPredictions.find(p => p.group_letter === groupLetter);
                      const result = groupResults.find(r => r.group_letter === groupLetter);

                      const pts = calculateGroupPoints(pred, result);
                      const isGroupCompleted = result && result.first_place && result.second_place;

                      return (
                        <div key={groupLetter} className="p-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl flex flex-col justify-between gap-3 hover:border-emerald-500/30 transition-all">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                            <span className="text-xs font-black text-white">GRUPO {groupLetter}</span>
                            {isGroupCompleted ? (
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${pts > 0
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-950 text-slate-600 border border-slate-900'
                                }`}>
                                +{pts} pts
                              </span>
                            ) : (
                              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                                Pendente
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 text-[10px]">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">1º Lugar</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`font-black uppercase tracking-tight ${pred?.first_place ? 'text-slate-200' : 'text-slate-600 italic'}`}>
                                  {pred?.first_place || 'Sem palpite'}
                                </span>
                                {isGroupCompleted && pred?.first_place && (
                                  <span className={pred.first_place === result.first_place ? 'text-emerald-400 font-bold' : 'text-rose-500 font-bold'}>
                                    {pred.first_place === result.first_place ? '✓' : '✗'}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">2º Lugar</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`font-black uppercase tracking-tight ${pred?.second_place ? 'text-slate-200' : 'text-slate-600 italic'}`}>
                                  {pred?.second_place || 'Sem palpite'}
                                </span>
                                {isGroupCompleted && pred?.second_place && (
                                  <span className={pred.second_place === result.second_place ? 'text-emerald-400 font-bold' : 'text-rose-500 font-bold'}>
                                    {pred.second_place === result.second_place ? '✓' : '✗'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {pred?.third_place && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">3º Lugar</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-black uppercase tracking-tight ${pred.third_place_qualified ? 'text-amber-400' : 'text-slate-400'} line-clamp-1 max-w-[80px]`}>
                                    {pred.third_place} {pred.third_place_qualified ? '⭐️' : ''}
                                  </span>
                                  {isGroupCompleted && (
                                    <span className={(pred.third_place_qualified && result.third_place_qualified && pred.third_place === result.third_place) ? 'text-emerald-400 font-bold' : 'text-rose-500 font-bold'}>
                                      {(pred.third_place_qualified && result.third_place_qualified && pred.third_place === result.third_place) ? '✓' : '✗'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
