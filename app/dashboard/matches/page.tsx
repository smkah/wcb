'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Filter, Save, Loader2, CheckCircle2, LayoutGrid, List as ListIcon, Edit2, LayoutList, RefreshCw, History, BarChart2, Eye, EyeOff, Lock } from 'lucide-react';
import Image from 'next/image';
import Flag from 'react-world-flags';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import MatchHistoryModal from '@/components/MatchHistoryModal';
import MatchStatsModal from '@/components/MatchStatsModal';

import { WORLD_CUP_DATA } from '@/lib/data';
import { getFlagCode } from '@/lib/countries';
import { formatMatchDate, formatMatchTime, parseMatchDateTime, normalizeTeamName, mapMatchesToBrazil } from '@/lib/utils';

export default function MatchesPage() {
  const [guesses, setGuesses] = useState<Record<string, { scoreA: string, scoreB: string, yellowCardsWinner?: string, hasRedCard?: boolean, custom_guesses?: Record<string, string>, pointsEarned?: number }>>({});
  const [existingGuesses, setExistingGuesses] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'compact' | 'list'>('grid');
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'matches' | 'standings'>('matches');
  const [groupBy, setGroupBy] = useState<'phase' | 'date'>('date');
  const [hideFinished, setHideFinished] = useState<boolean>(false);
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
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});

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
        setMatches(mapMatchesToBrazil(finalMatches));

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
            const guessesMap: Record<string, { scoreA: string, scoreB: string, yellowCardsWinner?: string, hasRedCard?: boolean, custom_guesses?: Record<string, string>, pointsEarned?: number }> = {};
            const existingSet = new Set<string>();
            guessesData.forEach(g => {
              existingSet.add(g.match_id);
              guessesMap[g.match_id] = {
                scoreA: String(g.score1),
                scoreB: String(g.score2),
                yellowCardsWinner: g.yellow_cards_winner || '',
                hasRedCard: g.has_red_card !== null ? g.has_red_card : undefined,
                custom_guesses: g.custom_guesses || {},
                pointsEarned: g.points_earned !== null ? g.points_earned : undefined
              };
            });
            setGuesses(guessesMap);
            setExistingGuesses(existingSet);
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
    const matchDateTime = parseMatchDateTime(match.date, match.time);
    return new Date() > matchDateTime;
  };

  const getGroupPredictionsDeadline = () => {
    if (!matches || matches.length === 0) return null;
    const groupMatches = matches.filter(m => m.group);
    if (groupMatches.length === 0) return null;

    const sorted = [...groupMatches].sort((a, b) => {
      const dateTimeA = parseMatchDateTime(a.date, a.time);
      const dateTimeB = parseMatchDateTime(b.date, b.time);
      return dateTimeA.getTime() - dateTimeB.getTime();
    });

    const secondRoundMatches: any[] = [];
    const groupCounts: Record<string, number> = {};
    for (const match of sorted) {
      const g = match.group;
      if (!groupCounts[g]) groupCounts[g] = 0;
      if (groupCounts[g] < 4) {
        secondRoundMatches.push(match);
        groupCounts[g]++;
      }
    }

    const sortedSecondRound = [...secondRoundMatches].sort((a, b) => {
      const dateTimeA = parseMatchDateTime(a.date, a.time);
      const dateTimeB = parseMatchDateTime(b.date, b.time);
      return dateTimeA.getTime() - dateTimeB.getTime();
    });

    if (sortedSecondRound.length === 0) return null;
    const lastMatch = sortedSecondRound[sortedSecondRound.length - 1];
    const lastMatchStart = parseMatchDateTime(lastMatch.date, lastMatch.time);
    return new Date(lastMatchStart.getTime() + 2 * 60 * 60 * 1000);
  };

  const isGroupPredictionsLocked = () => {
    return true;
  };

  const isGroupLockedGlobal = isGroupPredictionsLocked();

  const getPhaseName = (round: string, group?: string) => {
    const r = round.toLowerCase();
    if (r.includes('matchday') || group) {
      return "FASE DE GRUPOS";
    }
    if (r.includes('16-avos') || r.includes('32')) {
      return "16-AVOS DE FINAL";
    }
    if (r.includes('oitavas') || r.includes('16')) {
      return "OITAVAS DE FINAL";
    }
    if (r.includes('quartas') || r.includes('quarter')) {
      return "QUARTAS DE FINAL";
    }
    if (r.includes('semifinal') || r.includes('semi')) {
      return "SEMIFINAIS";
    }
    if (r.includes('3º') || r.includes('terceiro') || r.includes('third')) {
      return "DISPUTA DO 3º LUGAR";
    }
    if (r.includes('final')) {
      return "FINAL";
    }
    return round.toUpperCase();
  };

  const phaseOrder = [
    "FASE DE GRUPOS",
    "16-AVOS DE FINAL",
    "OITAVAS DE FINAL",
    "QUARTAS DE FINAL",
    "SEMIFINAIS",
    "DISPUTA DO 3º LUGAR",
    "FINAL"
  ];

  const resolvedMatches = React.useMemo(() => {
    if (!matches || matches.length === 0) return [];
    if (!groupResults || groupResults.length === 0) return matches;

    const firstPlaceMap = new Map<string, string>();
    const secondPlaceMap = new Map<string, string>();
    const thirdPlaceMap = new Map<string, string>();
    const qualifiedThirds: string[] = [];

    groupResults.forEach(gr => {
      const g = gr.group_letter;
      if (gr.first_place) firstPlaceMap.set(g, gr.first_place);
      if (gr.second_place) secondPlaceMap.set(g, gr.second_place);
      if (gr.third_place) {
        thirdPlaceMap.set(g, gr.third_place);
        if (gr.third_place_qualified) {
          qualifiedThirds.push(g);
        }
      }
    });

    let thirdPlaceAssignment: Record<string, string> = {};
    if (qualifiedThirds.length === 8) {
      const matchesWithThirds = [
        { id: 'm74', allowed: ['A', 'B', 'C', 'D', 'F'] },
        { id: 'm77', allowed: ['C', 'D', 'F', 'G', 'H'] },
        { id: 'm79', allowed: ['C', 'E', 'F', 'H', 'I'] },
        { id: 'm80', allowed: ['E', 'H', 'I', 'J', 'K'] },
        { id: 'm81', allowed: ['B', 'E', 'F', 'I', 'J'] },
        { id: 'm82', allowed: ['A', 'E', 'H', 'I', 'J'] },
        { id: 'm85', allowed: ['E', 'F', 'G', 'I', 'J'] },
        { id: 'm87', allowed: ['D', 'E', 'I', 'J', 'L'] }
      ];

      const assignment: Record<string, string> = {};
      const usedMatches = new Set<string>();

      const backtrack = (idx: number): boolean => {
        if (idx === qualifiedThirds.length) return true;
        const group = qualifiedThirds[idx];
        for (const m of matchesWithThirds) {
          if (!usedMatches.has(m.id) && m.allowed.includes(group)) {
            assignment[m.id] = group;
            usedMatches.add(m.id);
            if (backtrack(idx + 1)) return true;
            usedMatches.delete(m.id);
            delete assignment[m.id];
          }
        }
        return false;
      };

      qualifiedThirds.sort();
      if (backtrack(0)) {
        thirdPlaceAssignment = assignment;
      }
    }

    return matches.map(m => {
      const matchIdNum = parseInt(m.id.substring(1), 10);
      if (m.round.includes('16-avos') || (matchIdNum >= 73 && matchIdNum <= 88)) {
        let team1 = m.team1;
        let team2 = m.team2;

        const isPlaceholder = (t: string) => {
          if (!t) return false;
          if (t.match(/^[12][A-L]$/)) return true;
          if (t.startsWith('3') && t.includes('/')) return true;
          return false;
        };

        if (isPlaceholder(team1)) {
          if (team1.startsWith('1')) {
            const group = team1.substring(1);
            team1 = firstPlaceMap.get(group) || team1;
          } else if (team1.startsWith('2')) {
            const group = team1.substring(1);
            team1 = secondPlaceMap.get(group) || team1;
          }
        }

        if (isPlaceholder(team2)) {
          if (team2.startsWith('2')) {
            const group = team2.substring(1);
            team2 = secondPlaceMap.get(group) || team2;
          } else if (team2.startsWith('3')) {
            const assignedGroup = thirdPlaceAssignment[m.id];
            if (assignedGroup) {
              team2 = thirdPlaceMap.get(assignedGroup) || team2;
            }
          }
        }

        return { ...m, team1, team2 };
      }
      return m;
    });
  }, [matches, groupResults]);

  const visibleMatches = hideFinished
    ? resolvedMatches.filter(m => m.score1 === null || m.score2 === null)
    : resolvedMatches;

  const groupedMatches = visibleMatches.reduce((acc, match) => {
    const phase = getPhaseName(match.round, match.group);
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(match);
    return acc;
  }, {} as Record<string, any[]>);

  // Sort matches inside each group
  Object.keys(groupedMatches).forEach(phase => {
    if (phase === "FASE DE GRUPOS") {
      groupedMatches[phase].sort((a: any, b: any) => {
        const groupA = a.group || '';
        const groupB = b.group || '';
        if (groupA !== groupB) {
          return groupA.localeCompare(groupB);
        }
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        const timeA = a.time || '';
        const timeB = b.time || '';
        return timeA.localeCompare(timeB);
      });
    } else {
      groupedMatches[phase].sort((a: any, b: any) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        const timeA = a.time || '';
        const timeB = b.time || '';
        return timeA.localeCompare(timeB);
      });
    }
  });

  const sortedPhases = Object.keys(groupedMatches).sort((a: string, b: string) => {
    const idxA = phaseOrder.indexOf(a);
    const idxB = phaseOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  const togglePhaseCollapse = (phase: string) => {
    setCollapsedPhases(prev => ({
      ...prev,
      [phase]: !prev[phase]
    }));
  };

  const groupedByDate = visibleMatches.reduce((acc, match) => {
    const date = match.date || 'Sem Data';
    if (!acc[date]) acc[date] = [];
    acc[date].push(match);
    return acc;
  }, {} as Record<string, any[]>);

  // Sort matches inside each date
  Object.keys(groupedByDate).forEach(date => {
    groupedByDate[date].sort((a: any, b: any) => {
      const timeA = a.time || '';
      const timeB = b.time || '';
      return timeA.localeCompare(timeB);
    });
  });

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => a.localeCompare(b));

  const getFormattedDateHeader = (dateStr: string) => {
    if (!dateStr || dateStr === 'Sem Data') return 'Sem Data';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    const weekdays = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
    const months = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    const weekday = weekdays[date.getDay()];
    const monthName = months[date.getMonth()];
    return `${weekday}, ${parseInt(day, 10)} DE ${monthName}`;
  };

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
    if (!isAdmin && match && (isMatchStarted(match) || (match.score1 !== null && match.score2 !== null))) {
      toast.error("Este jogo já iniciou ou finalizou! Não é mais permitido salvar palpites.");
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
      setExistingGuesses(prev => {
        const next = new Set(prev);
        next.add(matchId);
        return next;
      });
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

  const currentStandings = React.useMemo(() => {
    const groupsList = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const standings: Record<string, Array<{ name: string, points: number, gd: number, gs: number, position: number, isBestThird: boolean }>> = {};
    const thirdPlaceTeams: Array<{ group: string, name: string, points: number, gd: number, gs: number }> = [];

    groupsList.forEach(groupLetter => {
      const groupMatches = matches.filter(m => m.group === groupLetter);
      const teamsSet = new Set<string>();
      groupMatches.forEach(m => {
        if (m.team1) teamsSet.add(m.team1);
        if (m.team2) teamsSet.add(m.team2);
      });

      const teamsStats: Record<string, { name: string, points: number, gd: number, gs: number }> = {};
      teamsSet.forEach(t => {
        teamsStats[t] = { name: t, points: 0, gd: 0, gs: 0 };
      });

      groupMatches.forEach(m => {
        if (m.score1 !== null && m.score2 !== null && m.score1 !== undefined && m.score2 !== undefined) {
          const s1 = Number(m.score1);
          const s2 = Number(m.score2);

          if (teamsStats[m.team1] && teamsStats[m.team2]) {
            teamsStats[m.team1].gs += s1;
            teamsStats[m.team2].gs += s2;
            teamsStats[m.team1].gd += (s1 - s2);
            teamsStats[m.team2].gd += (s2 - s1);

            if (s1 > s2) {
              teamsStats[m.team1].points += 3;
            } else if (s2 > s1) {
              teamsStats[m.team2].points += 3;
            } else {
              teamsStats[m.team1].points += 1;
              teamsStats[m.team2].points += 1;
            }
          }
        }
      });

      const sortedTeams = Object.values(teamsStats).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gs !== a.gs) return b.gs - a.gs;
        return a.name.localeCompare(b.name);
      });

      standings[groupLetter] = sortedTeams.map((t, idx) => ({
        ...t,
        position: idx + 1,
        isBestThird: false
      }));

      if (sortedTeams[2]) {
        thirdPlaceTeams.push({
          group: groupLetter,
          name: sortedTeams[2].name,
          points: sortedTeams[2].points,
          gd: sortedTeams[2].gd,
          gs: sortedTeams[2].gs
        });
      }
    });

    thirdPlaceTeams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gs !== a.gs) return b.gs - a.gs;
      return a.name.localeCompare(b.name);
    });

    const top8Thirds = new Set(thirdPlaceTeams.slice(0, 8).map(t => `${t.group}_${t.name}`));

    groupsList.forEach(groupLetter => {
      standings[groupLetter] = standings[groupLetter].map(t => ({
        ...t,
        isBestThird: top8Thirds.has(`${groupLetter}_${t.name}`)
      }));
    });

    return standings;
  }, [matches]);

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

  const handleAutocompleteMyPredictions = async () => {
    if (!user) return;
    const isConfirm = confirm("Deseja auto-completar a sua classificação dos grupos com base nos resultados atuais e nos seus palpites de placar?");
    if (!isConfirm) return;

    setSavingGroup('all');
    try {
      const groupsList = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
      const computedPredMap: Record<string, { firstPlace: string, secondPlace: string, thirdPlace: string, thirdPlaceQualified: boolean }> = {};
      const thirdPlaceTeams: Array<{ group: string, name: string, points: number, gd: number, gs: number }> = [];

      for (const groupLetter of groupsList) {
        const groupMatches = matches.filter(m => m.group === groupLetter);
        const teamsSet = new Set<string>();
        groupMatches.forEach(m => {
          if (m.team1) teamsSet.add(m.team1);
          if (m.team2) teamsSet.add(m.team2);
        });

        const teamsStats: Record<string, { name: string, points: number, gd: number, gs: number }> = {};
        teamsSet.forEach(t => {
          teamsStats[t] = { name: t, points: 0, gd: 0, gs: 0 };
        });

        groupMatches.forEach(m => {
          let s1: number | null = null;
          let s2: number | null = null;

          if (m.score1 !== null && m.score2 !== null && m.score1 !== undefined && m.score2 !== undefined) {
            s1 = Number(m.score1);
            s2 = Number(m.score2);
          } else {
            const userGuess = guesses[m.id];
            if (userGuess && userGuess.scoreA !== '' && userGuess.scoreB !== '') {
              s1 = Number(userGuess.scoreA);
              s2 = Number(userGuess.scoreB);
            }
          }

          if (s1 !== null && s2 !== null) {
            if (teamsStats[m.team1] && teamsStats[m.team2]) {
              teamsStats[m.team1].gs += s1;
              teamsStats[m.team2].gs += s2;
              teamsStats[m.team1].gd += (s1 - s2);
              teamsStats[m.team2].gd += (s2 - s1);

              if (s1 > s2) {
                teamsStats[m.team1].points += 3;
              } else if (s2 > s1) {
                teamsStats[m.team2].points += 3;
              } else {
                teamsStats[m.team1].points += 1;
                teamsStats[m.team2].points += 1;
              }
            }
          }
        });

        const sortedTeams = Object.values(teamsStats).sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.gd !== a.gd) return b.gd - a.gd;
          if (b.gs !== a.gs) return b.gs - a.gs;
          return a.name.localeCompare(b.name);
        });

        const firstPlace = sortedTeams[0]?.name || '';
        const secondPlace = sortedTeams[1]?.name || '';
        const thirdPlace = sortedTeams[2]?.name || '';

        computedPredMap[groupLetter] = {
          firstPlace,
          secondPlace,
          thirdPlace,
          thirdPlaceQualified: false
        };

        if (thirdPlace) {
          thirdPlaceTeams.push({
            group: groupLetter,
            name: thirdPlace,
            points: teamsStats[thirdPlace]?.points || 0,
            gd: teamsStats[thirdPlace]?.gd || 0,
            gs: teamsStats[thirdPlace]?.gs || 0
          });
        }
      }

      thirdPlaceTeams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gs !== a.gs) return b.gs - a.gs;
        return a.name.localeCompare(b.name);
      });

      const top8Thirds = new Set(thirdPlaceTeams.slice(0, 8).map(t => `${t.group}_${t.name}`));

      groupsList.forEach(groupLetter => {
        const pred = computedPredMap[groupLetter];
        if (pred && pred.thirdPlace && top8Thirds.has(`${groupLetter}_${pred.thirdPlace}`)) {
          pred.thirdPlaceQualified = true;
        }
      });

      const dbPayload = groupsList.map(groupLetter => {
        const pred = computedPredMap[groupLetter];
        return {
          profile_id: user.id,
          group_letter: groupLetter,
          first_place: pred.firstPlace || null,
          second_place: pred.secondPlace || null,
          third_place: pred.thirdPlace || null,
          third_place_qualified: pred.thirdPlaceQualified,
          updated_at: new Date().toISOString()
        };
      });

      const { error: saveError } = await supabase
        .from('group_predictions')
        .upsert(dbPayload, { onConflict: 'profile_id,group_letter' });

      if (saveError) throw saveError;

      setGroupPredictions(computedPredMap);
      toast.success("Seus palpites de grupo foram projetados e salvos com sucesso!");

      await supabase.rpc('recalculate_all_user_points');
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao projetar palpites: " + (err.message || "Tente novamente"));
    } finally {
      setSavingGroup(null);
    }
  };

  const handleSaveGroupPrediction = async (groupLetter: string) => {
    if (!user) {
      toast.error("Você precisa estar logado para salvar palpites!");
      return;
    }

    if (isGroupPredictionsLocked()) {
      toast.error("O prazo para palpites da fase de grupos expirou (fim da segunda rodada)!");
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

  const handleAIFillPredictions = async (roundMatches: any[], label: string) => {
    if (!user) {
      toast.error("Você precisa estar logado!");
      return;
    }

    const toastId = toast.loading(`Processando preenchimento com IA para ${label}...`);
    try {
      if (!roundMatches || roundMatches.length === 0) {
        throw new Error("Nenhuma partida encontrada nesta fase.");
      }

      const updatedGuessesMap = { ...guesses };
      const apiGuessesToUpsert: any[] = [];

      for (const match of roundMatches) {
        const team1 = match.team1;
        const team2 = match.team2;

        // 1. Calculate H2H history bias
        const teamSeed = team1.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) +
          team2.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);

        const deterministicScore = (offset: number, max: number) => {
          return (teamSeed + offset) % max;
        };

        const h2h = [
          { s1: deterministicScore(10, 3), s2: deterministicScore(20, 3) },
          { s1: deterministicScore(30, 3), s2: deterministicScore(45, 3) },
          { s1: deterministicScore(60, 4), s2: deterministicScore(75, 4) }
        ];

        let winsA = 0;
        let winsB = 0;
        h2h.forEach(h => {
          if (h.s1 > h.s2) winsA++;
          else if (h.s2 > h.s1) winsB++;
        });

        const h2hBias = winsA - winsB;

        // 2. Fetch news sentiment bias
        let newsBias = 0;
        try {
          const res = await fetch(`/api/news?team1=${encodeURIComponent(team1)}&team2=${encodeURIComponent(team2)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.articles) {
              json.articles.forEach((art: any) => {
                const title = art.title.toLowerCase();
                if (title.includes(team1.toLowerCase()) && (title.includes('favorit') || title.includes('venc') || title.includes('melhor') || title.includes('confianca'))) {
                  newsBias += 0.5;
                }
                if (title.includes(team2.toLowerCase()) && (title.includes('lesa') || title.includes('desfalqu') || title.includes('crise') || title.includes('preocup'))) {
                  newsBias += 0.5;
                }
                if (title.includes(team2.toLowerCase()) && (title.includes('favorit') || title.includes('venc') || title.includes('melhor') || title.includes('confianca'))) {
                  newsBias -= 0.5;
                }
                if (title.includes(team1.toLowerCase()) && (title.includes('lesa') || title.includes('desfalqu') || title.includes('crise') || title.includes('preocup'))) {
                  newsBias -= 0.5;
                }
              });
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch news for ${team1} vs ${team2}:`, e);
        }

        // 3. Score Heuristic
        let score1 = 1;
        let score2 = 1;
        const totalBias = h2hBias + newsBias;

        if (totalBias > 0.5) {
          score1 += Math.round(totalBias);
          if (totalBias > 1.5) score2 = Math.max(0, score2 - 1);
        } else if (totalBias < -0.5) {
          score2 += Math.round(Math.abs(totalBias));
          if (totalBias < -1.5) score1 = Math.max(0, score1 - 1);
        }

        const matchSeed = teamSeed % 3;
        if (matchSeed === 0) {
          score1 += 1;
        } else if (matchSeed === 1 && score1 === score2) {
          if (totalBias >= 0) score1 += 1;
          else score2 += 1;
        }

        score1 = Math.max(0, score1);
        score2 = Math.max(0, score2);

        // Standard details
        const hasRedCard = (teamSeed % 7) === 0;
        let yellowCardsWinner = 'Empate';
        if (teamSeed % 3 === 0) yellowCardsWinner = team1;
        else if (teamSeed % 3 === 1) yellowCardsWinner = team2;

        // Custom rules
        const customGuesses: Record<string, string> = {};
        userGroups.forEach((group: any) => {
          const rules = Array.isArray(group.custom_rules)
            ? group.custom_rules
            : Object.entries(group.custom_rules || {}).map(([k, v]) => ({ regra: k, resposta: '', pontos: Number(v) }));
          rules.forEach((rule: any) => {
            const key = `${group.id}_${rule.regra}`;
            customGuesses[key] = score1 > score2 ? team1 : score2 > score1 ? team2 : 'Empate';
          });
        });

        updatedGuessesMap[match.id] = {
          scoreA: String(score1),
          scoreB: String(score2),
          yellowCardsWinner,
          hasRedCard,
          custom_guesses: customGuesses
        };

        apiGuessesToUpsert.push({
          profile_id: user.id,
          match_id: match.id,
          score1,
          score2,
          yellow_cards_winner: yellowCardsWinner,
          has_red_card: hasRedCard,
          custom_guesses: customGuesses,
          updated_at: new Date().toISOString()
        });
      }

      const { error } = await supabase
        .from('guesses')
        .upsert(apiGuessesToUpsert, { onConflict: 'profile_id, match_id' });

      if (error) throw error;

      const { error: recalcError } = await supabase.rpc('recalculate_all_user_points');
      if (recalcError) {
        console.error("Recalculate points error:", recalcError);
      }

      setGuesses(updatedGuessesMap);
      setExistingGuesses(prev => {
        const next = new Set(prev);
        apiGuessesToUpsert.forEach(g => next.add(g.match_id));
        return next;
      });
      toast.success(`Palpites da fase ${label} preenchidos com sucesso!`, { id: toastId });
    } catch (err: any) {
      console.error("AI Fill failed:", err);
      toast.error("Erro ao preencher com IA: " + (err.message || "Tente novamente"), { id: toastId });
    }
  };

  const renderMatchCard = (match: any, i: number) => {
    const guess = guesses[match.id] || { scoreA: '', scoreB: '' };
    const isSaving = saving === match.id;
    const isSaved = saved === match.id;
    const isStarted = (isMatchStarted(match) || (match.score1 !== null && match.score2 !== null));
    const isEnded = match.score1 !== null && match.score2 !== null;

    if (viewMode === 'list') {
      return (
        <motion.div
          key={match.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.01 }}
          className={`glass p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-emerald-500/30 transition-all ${isEnded ? 'opacity-50 grayscale' : ''}`}
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
                  <Flag code={getFlagCode(match.team1)} className={`w-full h-full object-cover ${isEnded ? 'grayscale' : ''}`} />
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
                  <Flag code={getFlagCode(match.team2)} className={`w-full h-full object-cover ${isEnded ? 'grayscale' : ''}`} />
                </div>
                <span className="font-bold text-[10px] md:text-sm uppercase truncate text-left">{match.team2}</span>
              </div>
            </div>

            {isEnded && (
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-left space-y-2 mt-2 w-full">
                <div className="flex items-center justify-between border-b border-emerald-500/10 pb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Resultado Oficial
                  </span>
                  {guess.pointsEarned !== undefined && (
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                      +{guess.pointsEarned} pts
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

            {/* Standard card rules (Yellow / Red cards) */}
            <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 space-y-2 flex-shrink-0 mt-2">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-400">Cartões do Jogo</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                {/* Yellow Cards Winner */}
                <div className="flex items-center justify-between gap-2 flex-1">
                  <span className="text-[9px] text-slate-400 font-bold">Mais Amarelos (3 pts)</span>
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
                        onClick={() => {
                          setGuesses(prev => ({
                            ...prev,
                            [match.id]: {
                              ...prev[match.id] || { scoreA: '', scoreB: '' },
                              yellowCardsWinner: opt.value
                            }
                          }));
                        }}
                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all ${(guess.yellowCardsWinner && opt.value && normalizeTeamName(guess.yellowCardsWinner) === normalizeTeamName(opt.value))
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
                        className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all ${guess.hasRedCard === opt.value
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
              className={`p-2.5 rounded-xl transition-all ${isSaved ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-500 hover:text-emerald-400 bg-slate-900/50 hover:bg-emerald-400/10 disabled:opacity-30'
                }`}
              title={existingGuesses.has(match.id) ? 'Atualizar Palpite' : 'Salvar Palpite'}
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
        className={`glass rounded-[32px] group hover:border-emerald-500/30 transition-all ${viewMode === 'compact' ? 'p-6' : 'p-8'} ${isEnded ? 'opacity-50 grayscale' : ''}`}
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
              <Flag code={getFlagCode(match.team1)} className={`w-full h-full object-cover ${isEnded ? 'grayscale' : ''}`} fallback={<span className="font-bold text-[10px]">{match.team1.substring(0, 3).toUpperCase()}</span>} />
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
              <Flag code={getFlagCode(match.team2)} className={`w-full h-full object-cover ${isEnded ? 'grayscale' : ''}`} fallback={<span className="font-bold text-[10px]">{match.team2.substring(0, 3).toUpperCase()}</span>} />
            </div>
            <span className={`font-bold uppercase tracking-tight line-clamp-1 ${viewMode === 'compact' ? 'text-sm' : 'text-base'}`}>{match.team2}</span>
          </div>
        </div>

        {isEnded && (
          <div className="mb-4 p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-left space-y-2 w-full">
            <div className="flex items-center justify-between border-b border-emerald-500/10 pb-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Resultado Oficial
              </span>
              {guess.pointsEarned !== undefined && (
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                  +{guess.pointsEarned} pts
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
                    className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all flex-1 text-center truncate max-w-[120px] ${(guess.yellowCardsWinner && opt.value && normalizeTeamName(guess.yellowCardsWinner) === normalizeTeamName(opt.value))
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
                    className={`px-4 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all flex-1 text-center ${guess.hasRedCard === opt.value
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
              className={`flex items-center justify-center gap-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all w-full sm:w-auto shadow-lg shadow-emerald-500/20 ${viewMode === 'compact' ? 'px-4 py-2' : 'px-8 py-3'
                } ${isSaved
                  ? 'bg-emerald-500 text-slate-900'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none'
                }`}
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : isSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
              {isSaved ? 'SALVO' : existingGuesses.has(match.id) ? (viewMode === 'compact' ? 'ATUALIZAR' : 'ATUALIZAR PALPITE') : (viewMode === 'compact' ? 'SALVAR' : 'SALVAR PALPITE')}
            </button>
          </div>
        </div>
      </motion.div>
    );
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

          {/* Sub-tab switcher and Group-by option */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-12">
            <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700/50 w-full md:max-w-md">
              <button
                onClick={() => setActiveSubTab('matches')}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center ${activeSubTab === 'matches'
                  ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20'
                  : 'text-slate-500 hover:text-slate-300'
                  }`}
              >
                Partidas
              </button>
              <button
                onClick={() => setActiveSubTab('standings')}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center ${activeSubTab === 'standings'
                  ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20'
                  : 'text-slate-500 hover:text-slate-300'
                  }`}
              >
                Fase de Grupos (Classificação)
              </button>
            </div>

            {activeSubTab === 'matches' && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700/50">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3">
                    Agrupar por:
                  </span>
                  <button
                    onClick={() => setGroupBy('phase')}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${groupBy === 'phase'
                      ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20'
                      : 'text-slate-500 hover:text-slate-300'
                      }`}
                  >
                    Fases
                  </button>
                  <button
                    onClick={() => setGroupBy('date')}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${groupBy === 'date'
                      ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20'
                      : 'text-slate-500 hover:text-slate-300'
                      }`}
                  >
                    Datas
                  </button>
                </div>

                <button
                  onClick={() => setHideFinished(!hideFinished)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    hideFinished
                      ? 'bg-red-500/10 text-red-400 border-red-500/20 shadow-lg shadow-red-500/5'
                      : 'bg-slate-900/50 text-slate-500 border-slate-700/50 hover:text-slate-300 hover:border-slate-500/30'
                  }`}
                >
                  {hideFinished ? <EyeOff size={14} /> : <Eye size={14} />}
                  {hideFinished ? 'Ocultando Finalizados' : 'Ocultar Finalizados'}
                </button>
              </div>
            )}
          </div>

          {activeSubTab === 'matches' ? (
            visibleMatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 glass rounded-[32px] border-dashed border-slate-700/50 text-center w-full">
                <Calendar className="text-slate-600 mb-4 animate-pulse" size={48} />
                <h3 className="text-lg font-black uppercase text-white tracking-wide">Nenhuma partida encontrada</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                  {hideFinished ? 'Todas as partidas foram finalizadas!' : 'Não há partidas cadastradas.'}
                </p>
              </div>
            ) : groupBy === 'phase' ? (
              <div className="space-y-20">
                {sortedPhases.map((round, sectionIdx) => {
                  const roundMatches = groupedMatches[round];
                  if (!roundMatches || roundMatches.length === 0) return null;
                  const isCollapsed = collapsedPhases[round];
                  const totalCount = roundMatches.length;
                  const guessedCount = roundMatches.filter((m: any) => {
                    const g = guesses[m.id];
                    return g && g.scoreA !== '' && g.scoreB !== '';
                  }).length;

                  return (
                    <motion.section
                      key={round}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: sectionIdx * 0.1 }}
                    >
                      <div
                        className="flex items-center gap-6 mb-8 cursor-pointer select-none group"
                      >
                        <h2 className="text-xl font-black uppercase tracking-tighter text-emerald-400 flex flex-wrap items-center gap-3" onClick={() => togglePhaseCollapse(round)}>
                          {round}
                          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                            ({guessedCount}/{totalCount} salvos)
                          </span>
                        </h2>

                        <div className="flex gap-2 items-center flex-shrink-0">
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAIFillPredictions(roundMatches, round);
                              }}
                              className="px-3.5 py-1.5 bg-emerald-500 text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/15 cursor-pointer hover:scale-[1.03] active:scale-95"
                            >
                              Preencher IA
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => togglePhaseCollapse(round)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-wider transition-colors border border-slate-800/50 rounded-lg cursor-pointer"
                          >
                            {isCollapsed ? 'Expandir' : 'Minimizar'}
                          </button>
                        </div>

                        <div className="h-px flex-1 bg-slate-800 group-hover:bg-emerald-500/20 transition-colors" onClick={() => togglePhaseCollapse(round)} />
                      </div>

                      <AnimatePresence initial={false}>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            {round === "FASE DE GRUPOS" ? (
                              (() => {
                                const groupsMap: Record<string, any[]> = {};
                                (roundMatches as any[]).forEach(match => {
                                  const letter = match.group || 'Outros';
                                  if (!groupsMap[letter]) groupsMap[letter] = [];
                                  groupsMap[letter].push(match);
                                });
                                const sortedGroupLetters = Object.keys(groupsMap).sort();
                                return (
                                  <div className="space-y-16">
                                    {sortedGroupLetters.map((groupLetter) => {
                                      const groupMatchesList = groupsMap[groupLetter];
                                      return (
                                        <div key={groupLetter} className="space-y-6">
                                          <div className="flex items-center gap-4">
                                            <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-black uppercase tracking-widest rounded-xl">
                                              GRUPO {groupLetter.toUpperCase()}
                                            </span>
                                            <div className="h-px flex-1 bg-slate-800/40" />
                                          </div>
                                          <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2' :
                                            viewMode === 'compact' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
                                              'grid-cols-1'
                                            }`}>
                                            {groupMatchesList.map((match, i) => renderMatchCard(match, i))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()
                            ) : (
                              <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2' :
                                viewMode === 'compact' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
                                  'grid-cols-1'
                                }`}>
                                {(roundMatches as any[]).map((match, i) => renderMatchCard(match, i))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.section>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-20">
                {sortedDates.map((dateStr, sectionIdx) => {
                  const dateMatches = groupedByDate[dateStr];
                  if (!dateMatches || dateMatches.length === 0) return null;
                  const isCollapsed = collapsedPhases[dateStr];
                  const totalCount = dateMatches.length;
                  const guessedCount = dateMatches.filter((m: any) => {
                    const g = guesses[m.id];
                    return g && g.scoreA !== '' && g.scoreB !== '';
                  }).length;

                  const formattedHeader = getFormattedDateHeader(dateStr);

                  return (
                    <motion.section
                      key={dateStr}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: sectionIdx * 0.1 }}
                    >
                      <div
                        className="flex items-center gap-6 mb-8 cursor-pointer select-none group"
                      >
                        <h2 className="text-xl font-black uppercase tracking-tighter text-emerald-400 flex flex-wrap items-center gap-3" onClick={() => togglePhaseCollapse(dateStr)}>
                          {formattedHeader}
                          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                            ({guessedCount}/{totalCount} salvos)
                          </span>
                        </h2>

                        <div className="flex gap-2 items-center flex-shrink-0">
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAIFillPredictions(dateMatches, formattedHeader);
                              }}
                              className="px-3.5 py-1.5 bg-emerald-500 text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/15 cursor-pointer hover:scale-[1.03] active:scale-95"
                            >
                              Preencher IA
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => togglePhaseCollapse(dateStr)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-wider transition-colors border border-slate-800/50 rounded-lg cursor-pointer"
                          >
                            {isCollapsed ? 'Expandir' : 'Minimizar'}
                          </button>
                        </div>

                        <div className="h-px flex-1 bg-slate-800 group-hover:bg-emerald-500/20 transition-colors" onClick={() => togglePhaseCollapse(dateStr)} />
                      </div>

                      <AnimatePresence initial={false}>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2' :
                              viewMode === 'compact' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
                                'grid-cols-1'
                              }`}>
                              {(dateMatches as any[]).map((match, i) => renderMatchCard(match, i))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.section>
                  );
                })}
              </div>
            )
          ) : (
            <div className="space-y-12 pb-24">
              <div className="glass p-8 rounded-[32px] border-emerald-500/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-white">Palpite de Classificação dos Grupos</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Selecione o 1º, 2º e 3º colocados de cada grupo (A a L).</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    {user?.email === 'samukahweb@gmail.com' && (
                      <button
                        onClick={handleAutocompleteMyPredictions}
                        disabled={savingGroup === 'all'}
                        className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-500/10 flex items-center gap-2 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                      >
                        {savingGroup === 'all' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Projetando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            Projetar Meus Palpites
                          </>
                        )}
                      </button>
                    )}
                    <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-center min-w-[200px]">
                      <p className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Melhores Terceiros Selecionados</p>
                      <p className={`text-2xl font-black mt-1 ${totalQualifiedThirds === 8 ? 'text-emerald-400' : 'text-amber-500'}`}>
                        {totalQualifiedThirds} <span className="text-slate-600 text-sm">/ 8</span>
                      </p>
                    </div>
                  </div>
                </div>
                {isGroupLockedGlobal && (
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400">
                    <Lock size={16} className="animate-pulse shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                      Prazo encerrado! Não é mais possível alterar os palpites de classificação dos grupos.
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map(groupLetter => {
                  const groupTeams = getTeamsByGroup(groupLetter);
                  const pred = groupPredictions[groupLetter] || { firstPlace: '', secondPlace: '', thirdPlace: '', thirdPlaceQualified: false };
                  const actual = groupResults.find(r => r.group_letter === groupLetter);
                  const isSaving = savingGroup === groupLetter;
                  const isGroupLocked = isGroupPredictionsLocked();

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
                        </div>

                        <div className="space-y-4">
                          {/* Classificação Atual em Tempo Real */}
                          <div className="mb-4 bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-2xl">
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Classificação Atual Real</p>
                            <div className="space-y-1.5">
                              {currentStandings[groupLetter]?.map((team) => (
                                <div key={team.name} className="flex items-center justify-between text-[10px] font-bold py-1 border-b border-slate-900/40 last:border-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500 w-3">#{team.position}</span>
                                    <span className="text-slate-200 uppercase truncate max-w-[100px]">{team.name}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="flex gap-1.5 text-slate-400">
                                      <span>{team.points} pts</span>
                                      <span className="text-slate-600">|</span>
                                      <span>SG {team.gd >= 0 ? `+${team.gd}` : team.gd}</span>
                                    </div>
                                    {team.position === 3 && (
                                      <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider ${team.isBestThird
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        }`}>
                                        {team.isBestThird ? 'Melhor 3º (Top 8)' : 'Eliminado'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

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
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${pred.thirdPlaceQualified
                                  ? 'bg-amber-500 text-slate-900 shadow-md shadow-amber-500/10'
                                  : 'bg-slate-900 text-slate-600 hover:text-slate-400'
                                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                              >
                                {pred.thirdPlaceQualified ? 'Sim (Qualifica)' : 'Não'}
                              </button>
                            </div>
                          )}
                        </div>
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
