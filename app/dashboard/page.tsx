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
  const [historyModal, setHistoryModal] = useState<{ isOpen: boolean; teamA: string; teamB: string }>({
    isOpen: false,
    teamA: '',
    teamB: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) return;
      setLoading(true);
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          setUser(currentUser);
          
          // Fetch profile for points
          const { data: profile } = await supabase
            .from('profiles')
            .select('points, ranking_position')
            .eq('id', currentUser.id)
            .single();
          
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
        } else {
          router.push('/login');
          return;
        }

        // Fetch matches
        const { data: matches } = await supabase
          .from('matches')
          .select('*')
          .order('date', { ascending: true })
          .limit(3);
        
        if (matches && matches.length > 0) {
          setUpcomingMatches(matches);
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
            <Link href="/admin" className="px-4 py-1.5 bg-emerald-500 text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-400 transition-colors">
              Painel de Gestão
            </Link>
          </motion.div>
        )}
        {/* Welcome Header */}
        <header className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-400 mb-2">Painel de Controle</p>
            <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter">
              OLÁ, <span className="gradient-text italic">{user?.email?.split('@')[0]}</span>
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
          <div className="lg:col-span-2 flex flex-col gap-8">
            <section>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                  PRÓXIMAS PARTIDAS
                </h2>
                <Link href="/matches" className="text-xs font-bold text-emerald-400 flex items-center gap-2 hover:opacity-80 uppercase tracking-widest">
                  Ver todos <ChevronRight size={14} />
                </Link>
              </div>
              
              <div className="flex flex-col gap-4">
                {upcomingMatches.map((match) => (
                  <div key={match.id} className="bg-slate-800/40 border border-slate-700/50 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 hover:bg-slate-800/60 transition-all group">
                    <div className="flex items-center gap-2 sm:gap-4 flex-1">
                      <div className="flex items-center gap-2 min-w-[80px] sm:min-w-[140px]">
                        <div className="w-6 h-4 sm:w-10 sm:h-6 bg-slate-900 rounded-sm border border-slate-700 overflow-hidden flex items-center justify-center shadow-inner">
                          <Flag code={getFlagCode(match.team1)} className="w-full h-full object-cover" fallback={<span className="font-bold text-[8px]">{match.team1.substring(0,3).toUpperCase()}</span>} />
                        </div>
                        <span className="font-bold text-xs sm:text-lg truncate">{match.team1}</span>
                      </div>
                      <div className="text-slate-600 font-black text-sm sm:text-xl italic">VS</div>
                      <div className="flex items-center gap-2 min-w-[80px] sm:min-w-[140px] justify-end text-right">
                        <span className="font-bold text-xs sm:text-lg truncate">{match.team2}</span>
                        <div className="w-6 h-4 sm:w-10 sm:h-6 bg-slate-900 rounded-sm border border-slate-700 overflow-hidden flex items-center justify-center shadow-inner">
                          <Flag code={getFlagCode(match.team2)} className="w-full h-full object-cover" fallback={<span className="font-bold text-[8px]">{match.team2.substring(0,3).toUpperCase()}</span>} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          {new Date(match.date).toLocaleDateString('pt-BR', { month: 'short', day: '2-digit' }).toUpperCase()} — {match.time.split(' ')[0]}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setHistoryModal({ isOpen: true, teamA: match.team1, teamB: match.team2 })}
                          className="p-3 text-slate-500 hover:text-emerald-400 transition-colors bg-slate-900/50 rounded-xl"
                          title="Retrospecto"
                        >
                          <History size={16} />
                        </button>
                        <Link href="/matches" className="px-6 py-3 bg-emerald-500 text-slate-900 text-sm font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/10">
                          PALPITAR
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-8">
            <section className="bg-gradient-to-br from-emerald-500 to-cyan-600 p-8 rounded-[32px] shadow-xl shadow-emerald-500/10 relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="text-2xl font-black uppercase mb-4 leading-[1.1] text-slate-900">DESAFIE SEUS AMIGOS!</h3>
                <p className="text-slate-900/70 text-sm font-bold mb-8 uppercase tracking-tight">Crie um bolão privado agora.</p>
                <Link href="/groups" className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-sm rounded-2xl flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition-all">
                  <Users size={18} /> CRIAR BOLÃO
                </Link>
              </div>
              <div className="absolute -right-4 -bottom-4 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <Users size={120} />
              </div>
            </section>

            <section className="glass p-8 rounded-[32px]">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-3">
                RANKING GLOBAL
              </h3>
              <div className="flex flex-col gap-4">
                <div className="py-12 text-center">
                  <Trophy className="mx-auto text-slate-800 mb-4" size={32} />
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed">O ranking será atualizado após a abertura da copa</p>
                </div>
                <Link href="/ranking" className="mt-6 text-center text-[10px] font-bold text-slate-500 hover:text-emerald-400 uppercase tracking-[0.2em] transition-colors">
                  Ver Ranking Completo
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>

      <MatchHistoryModal 
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal(prev => ({ ...prev, isOpen: false }))}
        teamA={historyModal.teamA}
        teamB={historyModal.teamB}
      />
    </div>
  );
}
