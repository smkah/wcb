'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Plus, Hash, Copy, Check, ChevronRight, Trophy, Search } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api';

export default function GroupsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);
  
  // Logic states
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [createData, setCreateData] = useState({
    name: '',
    code: '',
    points_winner: 2,
    points_exact: 5,
    points_yellow_cards: 3,
    points_red_card: 4,
    points_group_both: 5,
    points_group_first: 3,
    points_group_second: 2,
    points_group_third_qual: 1
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    };
    checkUser();
  }, []);

  const isAdmin = user?.email === 'samukahweb@gmail.com';

  const [groups, setGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (!user) return;
      setLoadingGroups(true);
      try {
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select('*, profiles!groups_created_by_fkey(email, full_name)')
          .order('created_at', { ascending: false });
        
        if (groupsError) throw groupsError;

        const { data: countsData, error: countsError } = await supabase
          .from('group_members')
          .select('group_id');
        
        if (countsError) throw countsError;

        const countsMap = (countsData || []).reduce((acc: any, curr: any) => {
          acc[curr.group_id] = (acc[curr.group_id] || 0) + 1;
          return acc;
        }, {});

        const processedGroups = (groupsData || []).map(g => ({
          ...g,
          members: countsMap[g.id] || 0,
          rank: 1
        }));

        if (isMounted) setGroups(processedGroups);
      } catch (err) {
        console.error("Error fetching groups:", err);
      } finally {
        if (isMounted) setLoadingGroups(false);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [user]);

  const fetchGroups = async () => {
    // Manual trigger for refresh
    if (!user) return;
    setLoadingGroups(true);
    try {
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*, profiles!groups_created_by_fkey(email, full_name)')
        .order('created_at', { ascending: false });
      
      if (groupsError) throw groupsError;

      const { data: countsData, error: countsError } = await supabase
        .from('group_members')
        .select('group_id');
      
      if (countsError) throw countsError;

      const countsMap = (countsData || []).reduce((acc: any, curr: any) => {
        acc[curr.group_id] = (acc[curr.group_id] || 0) + 1;
        return acc;
      }, {});

      const processedGroups = (groupsData || []).map(g => ({
        ...g,
        members: countsMap[g.id] || 0,
        rank: 1
      }));

      setGroups(processedGroups);
    } catch (err) {
      console.error("Error fetching groups:", err);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode) return;
    setIsJoining(true);
    try {
      // Garantir que o perfil existe (caso o trigger tenha falhado)
      const { data: profileCheck } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();
      
      if (!profileCheck) {
        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          points: 0
        });
      }

      // Find group by code
      const { data: group, error: groupErr } = await supabase
        .from('groups')
        .select('id')
        .eq('code', joinCode.toUpperCase())
        .single();
      
      if (groupErr || !group) {
        toast.error("Código inválido ou bolão não encontrado");
        return;
      }

      const { error: joinErr } = await supabase
        .from('group_members')
        .insert({ profile_id: user.id, group_id: group.id });
      
      if (joinErr) {
        if (joinErr.code === '23505') {
          toast.info("Você já faz parte deste bolão!");
        } else {
          throw joinErr;
        }
      } else {
        toast.success("Você entrou no bolão!");
        await fetchGroups();
        setJoinCode('');
      }
    } catch (err: any) {
      toast.error("Erro ao entrar no bolão: " + (err.message || "Tente novamente mais tarde"));
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!createData.name) {
      toast.error("Dê um nome ao seu bolão!");
      return;
    }
    setIsCreating(true);
    try {
      await adminApi.createGroup({
        name: createData.name,
        code: createData.code || undefined,
        points_winner: createData.points_winner,
        points_exact: createData.points_exact,
        points_yellow_cards: createData.points_yellow_cards,
        points_red_card: createData.points_red_card,
        points_group_both: createData.points_group_both,
        points_group_first: createData.points_group_first,
        points_group_second: createData.points_group_second,
        points_group_third_qual: createData.points_group_third_qual
      });
      toast.success("Bolão criado com sucesso!");
      await fetchGroups();
      setShowCreate(false);
      setCreateData({
        name: '',
        code: '',
        points_winner: 2,
        points_exact: 5,
        points_yellow_cards: 3,
        points_red_card: 4,
        points_group_both: 5,
        points_group_first: 3,
        points_group_second: 2,
        points_group_third_qual: 1
      });
    } catch (err: any) {
      toast.error("Erro ao criar bolão: " + (err.message || "Verifique os dados"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(id as any);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100">
      <Navbar />

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-400 mb-2">Comunidades Privadas</p>
            <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter flex items-center gap-4">
              SEUS BOLÕES
            </h1>
          </div>
          
          <div className="flex gap-4">
            {isAdmin && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-3 px-8 py-4 bg-emerald-500 text-slate-900 font-black uppercase tracking-widest text-sm rounded-2xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:scale-95 transition-all"
              >
                <Plus size={20} /> NOVO BOLÃO
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {groups.length > 0 ? (
            groups.map((group, i) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass p-10 rounded-[32px] group cursor-pointer hover:border-emerald-500/30 transition-all flex flex-col h-full"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-10">
                  <div>
                    <h3 className="text-3xl font-black uppercase tracking-tight mb-2">{group.name}</h3>
                    <div className="flex items-center gap-6 text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                      <span className="flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-lg"><Users size={14} /> {group.members} membros</span>
                      <span className="flex items-center gap-2"><Trophy size={14} className="text-amber-500" /> {group.rank}º lugar</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopy(group.id, group.code); }}
                    className={`flex items-center gap-3 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-inner border border-slate-700/50 ${
                      copied === group.id ? 'bg-emerald-500 text-slate-900 border-emerald-400' : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Hash size={14} /> {group.code} {copied === group.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-8 border-t border-slate-700/30 mt-auto">
                  <div className="flex -space-x-4">
                    {[1, 2, 3, 4].map(idx => (
                      <div key={idx} className="w-12 h-12 rounded-full border-4 border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
                        <Image src={`https://picsum.photos/seed/${group.name + idx}/48/48`} alt="membro" width={48} height={48} className="opacity-80" />
                      </div>
                    ))}
                    <div className="w-12 h-12 rounded-full border-4 border-slate-800 bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-100 shadow-xl">+{group.members - 4}</div>
                  </div>
                  <div className="flex items-center gap-3 font-black text-xs uppercase tracking-[0.2em] text-emerald-400 group-hover:translate-x-2 transition-transform">
                    Classificação <ChevronRight size={18} />
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="glass p-12 rounded-[32px] flex flex-col items-center justify-center text-center opacity-80 border-dashed border-slate-700">
              <Users className="text-slate-800 mb-6" size={60} />
              <h3 className="text-xl font-bold uppercase tracking-tight mb-2">Sem bolões por agora</h3>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest max-w-[240px]">Crie seu bolão ou peça o código para um amigo entrar.</p>
            </div>
          )}

          {/* Join Group Card */}
          <div className="bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700/50 p-10 rounded-[32px] flex flex-col justify-center items-center text-center gap-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl pointer-events-none" />
            <div className="w-20 h-20 bg-slate-950 rounded-3xl flex items-center justify-center shadow-inner border border-slate-800">
              <Search size={40} className="text-slate-700 group-hover:text-emerald-500 transition-colors" />
            </div>
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-3">ENTRAR EM UM BOLÃO</h3>
              <p className="text-slate-500 text-sm font-medium max-w-[280px] mx-auto leading-relaxed">Recebeu um convite? Insira o código secreto para começar.</p>
            </div>
            <div className="flex w-full gap-3">
              <input 
                type="text" 
                placeholder="CÓDIGO SECRETO" 
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="flex-grow px-6 py-5 bg-slate-950 rounded-2xl border border-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/20 text-center font-black uppercase tracking-[0.3em] transition-all text-emerald-400 placeholder:text-slate-800"
              />
              <button 
                onClick={handleJoin}
                disabled={isJoining || !joinCode}
                className="px-8 bg-emerald-500 text-slate-900 font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/10 disabled:opacity-50"
              >
                {isJoining ? '...' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Modal for Create Group */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg glass p-6 sm:p-12 rounded-[24px] sm:rounded-[48px] overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl" />
              <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">NOVO BOLÃO</h2>
              <p className="text-slate-400 font-medium mb-10 leading-relaxed uppercase text-xs tracking-widest">Crie sua própria arena competitiva.</p>
              
              <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nome da Arena</label>
                  <input 
                    type="text" 
                    placeholder="Ex: AMIGOS DO FUTEBOL" 
                    value={createData.name}
                    onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                    className="w-full px-8 py-5 bg-slate-950 rounded-[20px] border border-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/20 uppercase font-bold tracking-tight text-white transition-all" 
                  />
                </div>
                
                {/* Scoring configurations */}
                <div className="space-y-4 p-5 bg-slate-950 rounded-3xl border border-slate-800">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">Pontuação das Regras</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-500">Resultado Certo</label>
                      <input 
                        type="number" 
                        value={createData.points_winner} 
                        onChange={e => setCreateData({ ...createData, points_winner: parseInt(e.target.value) || 0 })} 
                        className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl font-bold text-xs text-white" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-500">Placar Exato</label>
                      <input 
                        type="number" 
                        value={createData.points_exact} 
                        onChange={e => setCreateData({ ...createData, points_exact: parseInt(e.target.value) || 0 })} 
                        className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl font-bold text-xs text-white" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-500">Mais Amarelos</label>
                      <input 
                        type="number" 
                        value={createData.points_yellow_cards} 
                        onChange={e => setCreateData({ ...createData, points_yellow_cards: parseInt(e.target.value) || 0 })} 
                        className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl font-bold text-xs text-white" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-500">Teve Vermelho?</label>
                      <input 
                        type="number" 
                        value={createData.points_red_card} 
                        onChange={e => setCreateData({ ...createData, points_red_card: parseInt(e.target.value) || 0 })} 
                        className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl font-bold text-xs text-white" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-500">Grupo: Ambos</label>
                      <input 
                        type="number" 
                        value={createData.points_group_both} 
                        onChange={e => setCreateData({ ...createData, points_group_both: parseInt(e.target.value) || 0 })} 
                        className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl font-bold text-xs text-white" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-500">Grupo: Apenas 1º</label>
                      <input 
                        type="number" 
                        value={createData.points_group_first} 
                        onChange={e => setCreateData({ ...createData, points_group_first: parseInt(e.target.value) || 0 })} 
                        className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl font-bold text-xs text-white" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-500">Grupo: Apenas 2º</label>
                      <input 
                        type="number" 
                        value={createData.points_group_second} 
                        onChange={e => setCreateData({ ...createData, points_group_second: parseInt(e.target.value) || 0 })} 
                        className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl font-bold text-xs text-white" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-500">Grupo: Melhor 3º</label>
                      <input 
                        type="number" 
                        value={createData.points_group_third_qual} 
                        onChange={e => setCreateData({ ...createData, points_group_third_qual: parseInt(e.target.value) || 0 })} 
                        className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl font-bold text-xs text-white" 
                      />
                    </div>
                  </div>
                </div>

                {/* ID de Acesso is automatically generated in API, but let's keep the UI look if they want to override */}
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">ID de Acesso Automático (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="GERADO AUTOMATICAMENTE" 
                    value={createData.code}
                    onChange={(e) => setCreateData({ ...createData, code: e.target.value.toUpperCase() })}
                    className="w-full px-8 py-5 bg-slate-950 rounded-[20px] border border-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/20 font-black uppercase tracking-[0.2em] text-emerald-400 transition-all" 
                  />
                </div>
                <div className="flex gap-4 mt-6">
                  <button onClick={() => setShowCreate(false)} className="flex-1 py-5 font-bold uppercase tracking-widest text-xs text-slate-500 hover:text-white transition-colors">CANCELAR</button>
                  <button 
                    onClick={handleCreateGroup}
                    disabled={isCreating || !createData.name}
                    className="flex-[2] py-5 bg-emerald-500 text-slate-900 font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isCreating ? 'CRIANDO...' : 'FINALIZAR CRIAÇÃO'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
