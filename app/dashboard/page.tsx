'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { motion } from 'motion/react';
import { AlertTriangle, Trophy, Users, Star, ArrowUpRight, Calendar, ChevronRight, History } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Flag from 'react-world-flags';
import MatchHistoryModal from '@/components/MatchHistoryModal';

import { WORLD_CUP_DATA } from '@/lib/data';
import { getFlagCode } from '@/lib/countries';
import { formatMatchDate, formatMatchTime } from '@/lib/utils';
import EvolutionChart from '@/components/EvolutionChart';
import { BADGES_DEFINITION, calculateUserBadges } from '@/lib/badges';

export default function Dashboard() {
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([
    { label: 'Pontos Totais', value: '0', icon: Star, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Ranking Global', value: '-', icon: Trophy, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Meus Bolões', value: '0', icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  ]);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
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

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) return;
      setLoading(true);
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          setUser(currentUser);
          
          // Fetch profile for points and full_name
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, points, ranking_position')
            .eq('id', currentUser.id)
            .single();

          if (profile) {
            setProfileName(profile.full_name || currentUser.email?.split('@')[0] || '');
            setRankingPosition(profile.ranking_position || undefined);
          }
          
          // Fetch groups count
          const { count: groupsCount } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', currentUser.id);

          setStats([
            { label: 'Pontos Totais', value: String(profile?.points || 0), icon: Star, color: 'text-amber-400', bg: 'bg-amber-400/10' },
            { label: 'Ranking Global', value: profile?.ranking_position ? `${profile.ranking_position}º` : '-', icon: Trophy, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
            { label: 'Meus Bolões', value: String(groupsCount || 0), icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
          ]);

          // Fetch user guesses for badges
          const { data: guessesData } = await supabase
            .from('guesses')
            .select('points_earned')
            .eq('profile_id', currentUser.id);
          if (guessesData) setUserGuesses(guessesData);

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
        } else {
          router.push('/login');
          return;
        }

        // Fetch matches
        const { data: matches } = await supabase
          .from('matches')
          .select('*')
          .order('date', { ascending: true });
        
        if (matches && matches.length > 0) {
          setUpcomingMatches(matches.slice(0, 3));
          
          // Filter matches starting within the next 2 hours that the user hasn't predicted yet
          if (currentUser) {
            const { data: userGuesses } = await supabase
              .from('guesses')
              .select('match_id')
              .eq('profile_id', currentUser.id);

            const guessedMatchIds = new Set((userGuesses || []).map((g: any) => g.match_id));
            const now = new Date();
            const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
            
            const pending = matches.filter((match: any) => {
              if (guessedMatchIds.has(match.id)) return false;
              
              const timePart = match.time ? match.time.split(' ')[0] : '00:00';
              const matchDateTime = new Date(`${match.date}T${timePart}`);
              
              return matchDateTime > now && matchDateTime <= twoHoursFromNow;
            });
            
            setPendingReminderMatches(pending);
          }
        } else {
          setUpcomingMatches(WORLD_CUP_DATA.matches.slice(0, 3));
        }
      } catch (err) {
        console.error("Dashboard data fetch error:", err);
        setUpcomingMatches(WORLD_CUP_DATA.matches.slice(0, 3));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

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
          <div className="flex items-center gap-4 border-l border-slate-700 pl-8 hidden md:flex">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Saldo de Hoje</p>
              <p className="text-2xl font-black text-white leading-none">0 pts</p>
            </div>
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
                <h3 className="text-5xl font-black tracking-tighter">{stat.value}</h3>
              </div>
              <div className={`w-16 h-16 ${stat.bg} ${stat.color} flex items-center justify-center rounded-2xl shadow-inner`}>
                <stat.icon size={32} />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Feed */}
          <div className="lg:col-span-2 flex flex-col gap-12">
            {user && <EvolutionChart profileId={user.id} />}

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
                RANKING GLOBAL
              </h3>
              <div className="flex flex-col gap-4">
                <div className="py-12 text-center">
                  <Trophy className="mx-auto text-slate-800 mb-4" size={32} />
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed">O ranking será atualizado após a abertura da copa</p>
                </div>
                <Link href="/dashboard/ranking" className="mt-6 text-center text-[10px] font-bold text-slate-500 hover:text-emerald-400 uppercase tracking-[0.2em] transition-colors">
                  Ver Ranking Completo
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
