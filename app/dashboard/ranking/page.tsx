'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { motion } from 'motion/react';
import { Trophy, Medal, Star, AlertCircle, RefreshCw, X } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';
import EvolutionChart from '@/components/EvolutionChart';
import { BADGES_DEFINITION, calculateUserBadges } from '@/lib/badges';

export default function RankingPage() {
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedUserBadges, setSelectedUserBadges] = useState<string[]>([]);

  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('points', { ascending: false })
          .limit(100);
        
        if (error) throw error;
        setRanking(data || []);
      } catch (err) {
        console.error("Error fetching ranking:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRanking();
  }, []);

  useEffect(() => {
    const fetchSelectedUserBadges = async () => {
      if (!selectedUser) {
        setSelectedUserBadges([]);
        return;
      }
      try {
        const { data: guessesData } = await supabase
          .from('guesses')
          .select('points_earned')
          .eq('profile_id', selectedUser.id);
          
        const { data: groupPreds } = await supabase
          .from('group_predictions')
          .select('*')
          .eq('profile_id', selectedUser.id);
          
        const { data: resultsData } = await supabase
          .from('group_results')
          .select('*');
          
        const earned = calculateUserBadges(
          guessesData || [], 
          selectedUser.ranking_position || undefined,
          groupPreds || [],
          resultsData || []
        );
        setSelectedUserBadges(earned);
      } catch (err) {
        console.error("Error calculating selected user badges:", err);
      }
    };
    fetchSelectedUserBadges();
  }, [selectedUser]);

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100">
      <Navbar />

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        <header className="mb-14">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-400 mb-2">Quadro de Honra</p>
          <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter flex items-center gap-4">
            RANKING <span className="gradient-text italic">GLOBAL</span>
          </h1>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <RefreshCw size={48} className="animate-spin text-emerald-500 mb-4" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Calculando Posições...</p>
          </div>
        ) : ranking.length > 0 ? (
          <div className="grid gap-4">
             {/* Podium for top 3 */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-end">
                {ranking.slice(0, 3).map((user, idx) => {
                  const positions = [
                    { label: '2º', height: 'h-48', color: 'bg-slate-400/10 text-slate-400 border-slate-400/30', order: 'order-2 md:order-1' },
                    { label: '1º', height: 'h-64', color: 'bg-amber-400/10 text-amber-500 border-amber-400/30', order: 'order-1 md:order-2 shadow-2xl shadow-amber-400/5 my-6 md:my-0 scale-100 md:scale-110' },
                    { label: '3º', height: 'h-40', color: 'bg-orange-800/10 text-orange-800 border-orange-800/30', order: 'order-3' }
                  ];
                  const pos = idx === 0 ? positions[1] : idx === 1 ? positions[0] : positions[2];
                  
                  return (
                    <motion.div 
                      key={user.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.2 }}
                      onClick={() => setSelectedUser(user)}
                      className={`${pos.order} relative flex flex-col items-center cursor-pointer hover:scale-[1.03] transition-all`}
                    >
                      <div className="mb-6 relative">
                        <div className={`w-24 h-24 rounded-full border-4 ${pos.color.split(' ')[2]} flex items-center justify-center font-black text-4xl overflow-hidden shadow-2xl`}>
                          {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                        </div>
                        <div className={`absolute -top-4 -right-4 w-12 h-12 ${pos.color} flex items-center justify-center rounded-2xl font-black border-2 border-[#0F172A]`}>
                           {pos.label}
                        </div>
                      </div>
                      <div className={`w-full ${pos.height} ${pos.color} border-2 border-b-0 rounded-t-[40px] p-6 flex flex-col items-center justify-center text-center gap-2`}>
                        <h3 className="font-black uppercase tracking-tight text-lg line-clamp-1 truncate max-w-full flex items-center gap-1.5 justify-center">
                          <span>👑</span> {user.full_name || user.email?.split('@')[0]}
                        </h3>
                        <p className="font-black text-3xl">{user.points || 0}</p>
                        <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">PONTOS ACUMULADOS</p>
                      </div>
                    </motion.div>
                  )
                })}
             </div>

             {/* The rest of the list */}
             <div className="space-y-3 mt-12">
               {ranking.slice(3).map((user, idx) => (
                 <motion.div 
                   key={user.id}
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   onClick={() => setSelectedUser(user)}
                   className="glass p-6 rounded-2xl flex items-center justify-between group hover:border-emerald-500/30 cursor-pointer hover:scale-[1.01] hover:bg-slate-900/40 transition-all"
                 >
                   <div className="flex items-center gap-6">
                     <span className="w-8 font-black text-slate-700 italic text-xl">#{(idx + 4)}</span>
                     <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center font-black text-slate-400 group-hover:text-emerald-400 transition-colors uppercase">
                       {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                     </div>
                     <div>
                       <p className="font-bold text-white group-hover:text-emerald-400 transition-colors">{user.full_name || user.email?.split('@')[0]}</p>
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{user.email?.replace(/(.{3}).*(@.*)/, '$1***$2')}</p>
                     </div>
                   </div>
                   <div className="flex flex-col items-end">
                      <p className="text-2xl font-black text-white">{user.points || 0}</p>
                      <p className="text-[8px] font-black uppercase text-slate-700 tracking-widest">PONTOS</p>
                   </div>
                 </motion.div>
               ))}
             </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 glass rounded-[40px] border-dashed border-slate-700">
            <Trophy className="text-slate-800 mb-6" size={80} />
            <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Ranking em breve</h2>
            <p className="text-slate-400 font-medium text-center max-w-md px-6">
              O quadro de pontuação global será ativado assim que as primeiras partidas da Copa 2026 forem concluídas.
            </p>
          </div>
        )}
      </main>

      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass w-full max-w-2xl p-6 sm:p-10 rounded-[32px] sm:rounded-[40px] shadow-2xl relative border border-slate-800"
            >
              <button 
                onClick={() => setSelectedUser(null)}
                className="absolute top-6 right-6 p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 mt-2">
                <div className="w-20 h-20 bg-gradient-to-tr from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center text-3xl font-black text-slate-900 shadow-xl shadow-emerald-500/10 overflow-hidden">
                  {selectedUser.avatar_url ? (
                    <img 
                      src={selectedUser.avatar_url} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    selectedUser.full_name?.[0]?.toUpperCase() || selectedUser.email?.[0]?.toUpperCase() || '?'
                  )}
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="text-2xl font-black uppercase tracking-tight text-white">{selectedUser.full_name || selectedUser.email?.split('@')[0]}</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Pontos Acumulados: <span className="text-emerald-400 font-black">{selectedUser.points || 0}</span></p>
                </div>
              </div>

              {selectedUserBadges.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6 justify-center sm:justify-start">
                  {BADGES_DEFINITION.filter(b => selectedUserBadges.includes(b.id)).map(badge => (
                    <span 
                      key={badge.id}
                      className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border ${badge.color} flex items-center gap-1.5`}
                      title={badge.description}
                    >
                      <span>{badge.icon}</span> {badge.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="w-full">
                <EvolutionChart profileId={selectedUser.id} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
