'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Users, Calendar, Settings, ChevronRight, Search, Trash2, Edit, RefreshCw, Plus, CheckCircle2, AlertTriangle, Trophy, Download, Upload, Sparkles } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { toast } from 'sonner';
import { formatMatchDate, formatMatchTime, mapMatchesToBrazil } from '@/lib/utils';

type TabType = 'overview' | 'users' | 'groups' | 'matches' | 'standings';

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

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [groupResults, setGroupResults] = useState<any[]>([]);
  const [savingStanding, setSavingStanding] = useState<string | null>(null);
  
  // Data state
  const [data, setData] = useState({
    users: [] as any[],
    groups: [] as any[],
    matches: [] as any[]
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [allGuesses, setAllGuesses] = useState<any[]>([]);
  const [allGroupPredictions, setAllGroupPredictions] = useState<any[]>([]);

  const [matchGroupBy, setMatchGroupBy] = useState<'date' | 'phase'>('date');

  const groupedMatchesByDate = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    data.matches.forEach(m => {
      const date = m.date || 'Sem Data';
      if (!groups[date]) groups[date] = [];
      groups[date].push(m);
    });
    
    // Sort matches inside each group by time
    Object.keys(groups).forEach(date => {
      groups[date].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    });
    
    return groups;
  }, [data.matches]);

  const sortedMatchDates = React.useMemo(() => {
    return Object.keys(groupedMatchesByDate).sort();
  }, [groupedMatchesByDate]);

  const groupedMatchesByPhase = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    data.matches.forEach(m => {
      const phase = getPhaseName(m.round, m.group);
      if (!groups[phase]) groups[phase] = [];
      groups[phase].push(m);
    });
    
    // Sort matches inside each group by date/time
    Object.keys(groups).forEach(phase => {
      groups[phase].sort((a, b) => {
        if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
        return (a.time || '').localeCompare(b.time || '');
      });
    });
    
    return groups;
  }, [data.matches]);

  const sortedMatchPhases = React.useMemo(() => {
    const phaseOrder = [
      "FASE DE GRUPOS",
      "16-AVOS DE FINAL",
      "OITAVAS DE FINAL",
      "QUARTAS DE FINAL",
      "SEMIFINAIS",
      "DISPUTA DO 3º LUGAR",
      "FINAL"
    ];
    return Object.keys(groupedMatchesByPhase).sort((a, b) => {
      const idxA = phaseOrder.indexOf(a);
      const idxB = phaseOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [groupedMatchesByPhase]);

  // Modal states
  const [editingItem, setEditingItem] = useState<{ type: TabType | 'add_user' | 'add_match' | 'add_group', data: any } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);

  useEffect(() => {
    if (editingItem?.type === 'groups' && editingItem.data.id && isSupabaseConfigured) {
       adminApi.getGroupMembers(editingItem.data.id).then(setGroupMembers);
    }
    return () => setGroupMembers([]);
  }, [editingItem]);

  const fetchAllData = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const [users, groups, matches, guessesRes, groupPredsRes] = await Promise.all([
        adminApi.getUsers().catch(e => { 
          console.error("Users fetch error:", e?.message || e); 
          return []; 
        }),
        adminApi.getGroups().catch(e => { 
          console.error("Groups fetch error:", e?.message || e); 
          return []; 
        }),
        adminApi.getMatches().catch(e => { 
          console.error("Matches fetch error:", e?.message || e); 
          return []; 
        }),
        supabase.from('guesses').select('profile_id, match_id, score1, score2').then(res => res.data || []),
        supabase.from('group_predictions').select('profile_id, group_letter').then(res => res.data || [])
      ]);
      console.log("Fetched admin data:", { usersCount: users.length, groupsCount: groups.length, matchesCount: matches.length, guessesCount: guessesRes.length, groupPredsCount: groupPredsRes.length });
      setData({ users: users || [], groups: groups || [], matches: mapMatchesToBrazil(matches || []) });
      setAllGuesses(guessesRes || []);
      setAllGroupPredictions(groupPredsRes || []);
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupResults = async () => {
    const { data: resData } = await supabase.from('group_results').select('*').order('group_letter', { ascending: true });
    if (resData) setGroupResults(resData);
  };

  useEffect(() => {
    const checkUser = async () => {
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.email !== 'samukahweb@gmail.com') {
        router.push('/dashboard');
      } else {
        setUser(user);
        // Automatically run initial matches sync and guesses yellow card normalization on load
        try {
          await adminApi.syncInitialMatches();
          console.log("Automatic matches and guesses sync successful on admin page load.");
        } catch (syncErr) {
          console.error("Automatic sync on admin load failed:", syncErr);
        }
        await fetchAllData();
        await fetchGroupResults();
      }
      setLoading(false);
    };
    checkUser();
  }, [router]);



  const phaseTotalMatches = React.useMemo(() => {
    const counts: Record<string, number> = {};
    data.matches.forEach(m => {
      const phase = getPhaseName(m.round, m.group);
      counts[phase] = (counts[phase] || 0) + 1;
    });
    return counts;
  }, [data.matches]);

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

  const handleSyncMatches = async () => {
    setIsSyncing(true);
    try {
      await adminApi.syncInitialMatches();
      await fetchAllData();
      toast.success("Jogos sincronizados com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao sincronizar: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSimulateResults = async () => {
    if (!confirm("Isso irá simular resultados para todas as partidas sem resultado definido. Continuar?")) return;
    setIsSyncing(true);
    try {
      await adminApi.simulateResults();
      await fetchAllData();
      toast.success("Resultados simulados com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao simular: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };



  const handleDeleteUser = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
    setIsActionLoading(id);
    try {
      await adminApi.deleteUser(id);
      await fetchAllData();
      toast.success("Usuário excluído com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao excluir usuário: " + (error.message || "Tente novamente"));
    } finally {
      setIsActionLoading(null);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-emerald-400 bg-[#0F172A]">Carregando...</div>;

  const stats = [
    { label: 'Usuários Totais', value: data.users.length, icon: Users, color: 'text-emerald-400' },
    { label: 'Bolões Ativos', value: data.groups.length, icon: Trophy, color: 'text-cyan-400' },
    { label: 'Partidas Totais', value: data.matches.length, icon: Calendar, color: 'text-amber-400' },
  ];

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setModalLoading(true);
    try {
      if (editingItem.type === 'users') {
        await adminApi.updateUser(editingItem.data.id, editingItem.data);
        toast.success("Perfil atualizado!");
      } else if (editingItem.type === 'add_user') {
        if (!editingItem.data.email || !editingItem.data.password || !editingItem.data.username || !editingItem.data.full_name) {
          throw new Error("Preencha todos os campos obrigatórios.");
        }
        await adminApi.createUser({
          email: editingItem.data.email,
          password: editingItem.data.password,
          username: editingItem.data.username,
          full_name: editingItem.data.full_name,
        });
        toast.success("Usuário criado com sucesso!");
      }
      await fetchAllData();
      setEditingItem(null);
    } catch (error: any) {
      toast.error("Erro ao salvar usuário: " + (error.message || "Verifique os dados"));
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setModalLoading(true);
    try {
      if (editingItem.type === 'groups') {
        await adminApi.updateGroup(editingItem.data.id, editingItem.data);
        toast.success("Bolão atualizado!");
      } else {
        await adminApi.createGroup(editingItem.data);
        toast.success("Novo bolão criado!");
      }
      await fetchAllData();
      setEditingItem(null);
    } catch (error: any) {
      toast.error("Erro ao salvar bolão: " + (error.message || "Verifique os dados"));
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setModalLoading(true);
    try {
      if (editingItem.type === 'matches') {
        await adminApi.updateMatch(editingItem.data.id, editingItem.data);
        toast.success("Partida atualizada!");
      } else {
        await adminApi.createMatch(editingItem.data);
        toast.success("Nova partida criada!");
      }
      await fetchAllData();
      setEditingItem(null);
    } catch (error: any) {
      toast.error("Erro ao salvar partida: " + (error.message || "Verifique os dados"));
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveGroupResults = async (groupLetter: string, firstPlace: string, secondPlace: string, thirdPlace: string, thirdPlaceQualified: boolean) => {
    if (firstPlace === secondPlace || firstPlace === thirdPlace || secondPlace === thirdPlace) {
      toast.error("Os times selecionados devem ser diferentes!");
      return;
    }
    setSavingStanding(groupLetter);
    try {
      const { error } = await supabase
        .from('group_results')
        .upsert({
          group_letter: groupLetter,
          first_place: firstPlace || null,
          second_place: secondPlace || null,
          third_place: thirdPlace || null,
          third_place_qualified: thirdPlaceQualified || false,
          updated_at: new Date().toISOString()
        }, { onConflict: 'group_letter' });
      
      if (error) throw error;
      toast.success(`Resultado do Grupo ${groupLetter} salvo com sucesso!`);
      await fetchGroupResults();
    } catch (err: any) {
      toast.error("Erro ao salvar resultado de grupo: " + (err.message || "Tente novamente"));
    } finally {
      setSavingStanding(null);
    }
  };

  const handleForceRecalculatePoints = async () => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.rpc('recalculate_all_user_points');
      if (error) throw error;
      toast.success("Pontuações recalculadas com sucesso!");
      await fetchAllData();
    } catch (err: any) {
      toast.error("Erro ao recalcular: " + (err.message || "Verifique se a função existe no Supabase"));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportGuesses = async () => {
    const toastId = toast.loading("Preparando exportação de palpites...");
    try {
      const exportData = await adminApi.exportAllGuesses();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(exportData, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", jsonString);
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute("download", `wcb_palpites_export_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Palpites exportados com sucesso!", { id: toastId });
    } catch (error: any) {
      toast.error("Erro ao exportar palpites: " + (error.message || error), { id: toastId });
    }
  };

  const handleImportGuesses = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const toastId = toast.loading("Importando palpites...");
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json || (!Array.isArray(json.guesses) && !Array.isArray(json.group_predictions))) {
          throw new Error("Formato de arquivo inválido. O JSON deve conter 'guesses' ou 'group_predictions'.");
        }

        const guessesCount = json.guesses?.length || 0;
        const groupPredsCount = json.group_predictions?.length || 0;

        await adminApi.importGuesses(json.guesses || [], json.group_predictions || []);
        
        toast.success(`Importação concluída! Carregados ${guessesCount} palpites e ${groupPredsCount} palpites de grupo.`, { id: toastId });
        await fetchAllData();
      } catch (error: any) {
        toast.error("Erro ao importar: " + (error.message || error), { id: toastId });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const getTeamsByGroup = (groupLetter: string) => {
    const groupMatches = data.matches.filter(m => m.group === groupLetter);
    const teams = new Set<string>();
    groupMatches.forEach(m => {
      if (m.team1) teams.add(m.team1);
      if (m.team2) teams.add(m.team2);
    });
    return Array.from(teams);
  };
  const getUserProgressPerPhase = (profileId: string) => {
    const userGuesses = allGuesses.filter(g => g.profile_id === profileId && g.score1 !== null && g.score2 !== null);
    const completedCounts: Record<string, number> = {};
    userGuesses.forEach(g => {
      const match = data.matches.find(m => m.id === g.match_id);
      if (match) {
        const phase = getPhaseName(match.round, match.group);
        completedCounts[phase] = (completedCounts[phase] || 0) + 1;
      }
    });
    return completedCounts;
  };

  const getUserGroupPredictionsCount = (profileId: string) => {
    return allGroupPredictions.filter(p => p.profile_id === profileId).length;
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100">
      <Navbar />

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        <header className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 text-emerald-400 mb-2">
              <ShieldAlert size={16} />
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Ambiente Administrativo</p>
            </div>
            <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter">
              GESTÃO DO <span className="gradient-text italic">SISTEMA</span>
            </h1>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700/50 gap-1 sm:gap-0 w-full sm:w-auto">
            {(['overview', 'users', 'groups', 'matches', 'standings'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all flex-1 text-center ${
                  activeTab === tab 
                    ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab === 'overview' ? 'Geral' : tab === 'users' ? 'Usuários' : tab === 'groups' ? 'Bolões' : tab === 'matches' ? 'Jogos' : 'Grupos (Classificação)'}
              </button>
            ))}
          </div>
        </header>

        <AnimatePresence>
          {editingItem && (
            <motion.div
              key="editing-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="glass w-full max-w-2xl p-6 sm:p-10 rounded-[24px] sm:rounded-[40px] max-h-[90vh] overflow-y-auto shadow-2xl shadow-emerald-500/10"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-black uppercase tracking-tighter">
                    {editingItem.type.includes('add') ? 'ADICIONAR' : 'EDITAR'} {editingItem.type.replace('add_', '').toUpperCase()}
                  </h2>
                  <button onClick={() => setEditingItem(null)} className="text-slate-500 hover:text-white font-black text-xs uppercase tracking-widest">Fechar</button>
                </div>

                {(editingItem.type === 'users' || editingItem.type === 'add_user') && (
                  <form onSubmit={handleSaveUser} className="space-y-6">
                    {editingItem.type === 'add_user' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">E-mail</label>
                          <input 
                            type="email" 
                            required
                            value={editingItem.data.email || ''} 
                            onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, email: e.target.value } })}
                            className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl outline-none focus:border-emerald-500 transition-all font-bold"
                            placeholder="seu@email.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nome de Usuário</label>
                          <input 
                            type="text" 
                            required
                            value={editingItem.data.username || ''} 
                            onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, username: e.target.value.replace(/[^a-zA-Z0-9_.-]/g, '') } })}
                            className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl outline-none focus:border-emerald-500 transition-all font-bold"
                            placeholder="usuario"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Senha</label>
                          <input 
                            type="password" 
                            required
                            value={editingItem.data.password || ''} 
                            onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, password: e.target.value } })}
                            className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl outline-none focus:border-emerald-500 transition-all font-bold"
                            placeholder="••••••••"
                          />
                        </div>
                      </>
                    )}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nome Completo</label>
                      <input 
                        type="text" 
                        required={editingItem.type === 'add_user'}
                        value={editingItem.data.full_name || ''} 
                        onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, full_name: e.target.value } })}
                        className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl outline-none focus:border-emerald-500 transition-all font-bold"
                        placeholder="Nome do usuário"
                      />
                    </div>
                    {editingItem.type === 'users' && (
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pontos Digitais</label>
                         <input 
                          type="number" 
                          value={editingItem.data.points || 0} 
                          onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, points: parseInt(e.target.value) } })}
                          className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl outline-none focus:border-emerald-500 transition-all font-bold"
                        />
                      </div>
                    )}
                    <button type="submit" disabled={modalLoading} className="w-full py-5 bg-emerald-500 text-slate-900 font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all">
                      {modalLoading ? <RefreshCw size={20} className="animate-spin mx-auto" /> : editingItem.type === 'add_user' ? 'Criar Usuário' : 'Atualizar Perfil'}
                    </button>
                  </form>
                )}

                {(editingItem.type === 'groups' || editingItem.type === 'add_group') && (
                  <form onSubmit={handleSaveGroup} className="space-y-6 pb-20">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nome do Bolão</label>
                        <input 
                          type="text" 
                          required
                          value={editingItem.data.name || ''} 
                          onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
                          className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl outline-none focus:border-emerald-500 transition-all font-bold"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Time Ganhador</label>
                            <input type="number" value={editingItem.data.points_winner !== undefined && editingItem.data.points_winner !== null ? editingItem.data.points_winner : 2} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, points_winner: parseInt(e.target.value) || 0 } })} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Resultado Exato</label>
                            <input type="number" value={editingItem.data.points_exact !== undefined && editingItem.data.points_exact !== null ? editingItem.data.points_exact : 5} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, points_exact: parseInt(e.target.value) || 0 } })} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Mais Amarelos</label>
                            <input type="number" value={editingItem.data.points_yellow_cards !== undefined && editingItem.data.points_yellow_cards !== null ? editingItem.data.points_yellow_cards : 3} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, points_yellow_cards: parseInt(e.target.value) || 0 } })} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Teve Vermelho?</label>
                            <input type="number" value={editingItem.data.points_red_card !== undefined && editingItem.data.points_red_card !== null ? editingItem.data.points_red_card : 4} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, points_red_card: parseInt(e.target.value) || 0 } })} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none" />
                         </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Grupo: Ambos</label>
                            <input type="number" value={editingItem.data.points_group_both !== undefined && editingItem.data.points_group_both !== null ? editingItem.data.points_group_both : 5} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, points_group_both: parseInt(e.target.value) || 0 } })} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Grupo: Apenas 1º</label>
                            <input type="number" value={editingItem.data.points_group_first !== undefined && editingItem.data.points_group_first !== null ? editingItem.data.points_group_first : 3} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, points_group_first: parseInt(e.target.value) || 0 } })} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Grupo: Apenas 2º</label>
                            <input type="number" value={editingItem.data.points_group_second !== undefined && editingItem.data.points_group_second !== null ? editingItem.data.points_group_second : 2} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, points_group_second: parseInt(e.target.value) || 0 } })} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Grupo: Melhor 3º</label>
                            <input type="number" value={editingItem.data.points_group_third_qual !== undefined && editingItem.data.points_group_third_qual !== null ? editingItem.data.points_group_third_qual : 1} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, points_group_third_qual: parseInt(e.target.value) || 0 } })} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none" />
                         </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-6 bg-slate-950/50 rounded-3xl border border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Regras Personalizadas</label>
                        <button 
                          type="button"
                          onClick={() => {
                            const currentRules = Array.isArray(editingItem.data.custom_rules) 
                              ? editingItem.data.custom_rules 
                              : Object.entries(editingItem.data.custom_rules || {}).map(([k, v]) => ({ regra: k, resposta: '', pontos: Number(v) }));
                            const updated = [...currentRules, { regra: '', resposta: '', pontos: 0 }];
                            setEditingItem({ ...editingItem, data: { ...editingItem.data, custom_rules: updated } });
                          }}
                          className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                        >+ ADICIONAR REGRA</button>
                      </div>
                      <div className="space-y-3">
                        {(() => {
                          const rulesList = Array.isArray(editingItem.data.custom_rules) 
                            ? editingItem.data.custom_rules 
                            : Object.entries(editingItem.data.custom_rules || {}).map(([k, v]) => ({ regra: k, resposta: '', pontos: Number(v) }));

                          return (
                            <>
                              {rulesList.map((rule: any, idx: number) => (
                                <div key={idx} className="flex flex-col sm:flex-row gap-2 border-b border-slate-800 pb-3">
                                  <input 
                                    placeholder="Regra (Ex: Primeiro gol)"
                                    className="flex-2 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs font-bold text-white outline-none" 
                                    value={rule.regra || ''}
                                    onChange={(e) => {
                                      const updated = [...rulesList];
                                      updated[idx] = { ...updated[idx], regra: e.target.value };
                                      setEditingItem({ ...editingItem, data: { ...editingItem.data, custom_rules: updated } });
                                    }}
                                  />
                                  <input 
                                    placeholder="Resposta oficial"
                                    className="flex-1 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs font-bold text-white outline-none" 
                                    value={rule.resposta || ''}
                                    onChange={(e) => {
                                      const updated = [...rulesList];
                                      updated[idx] = { ...updated[idx], resposta: e.target.value };
                                      setEditingItem({ ...editingItem, data: { ...editingItem.data, custom_rules: updated } });
                                    }}
                                  />
                                  <input 
                                    type="number"
                                    placeholder="Pts"
                                    className="w-20 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs font-bold text-center text-white outline-none" 
                                    value={rule.pontos || 0}
                                    onChange={(e) => {
                                      const updated = [...rulesList];
                                      updated[idx] = { ...updated[idx], pontos: parseInt(e.target.value) || 0 };
                                      setEditingItem({ ...editingItem, data: { ...editingItem.data, custom_rules: updated } });
                                    }}
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const updated = rulesList.filter((_: any, i: number) => i !== idx);
                                      setEditingItem({ ...editingItem, data: { ...editingItem.data, custom_rules: updated } });
                                    }}
                                    className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                                  >Excluir</button>
                                </div>
                              ))}
                              {rulesList.length === 0 && (
                                <p className="text-[10px] text-slate-600 font-bold uppercase text-center py-2">Sem regras personalizadas</p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    
                    {!editingItem.type.includes('add') && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Membros Atuais ({groupMembers.length})</label>
                        </div>
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                           {groupMembers.map(m => (
                             <div key={m.profile_id} className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800 group">
                                <span className="text-xs font-bold truncate pr-4">{m.profiles?.email}</span>
                                <button 
                                  type="button"
                                  onClick={async () => {
                                    if(confirm('Remover usuário do bolão?')) {
                                      try {
                                        await adminApi.removeUserFromGroup(m.profile_id, editingItem.data.id);
                                        const updated = await adminApi.getGroupMembers(editingItem.data.id);
                                        setGroupMembers(updated);
                                        toast.success("Usuário removido do bolão!");
                                      } catch (err: any) {
                                        toast.error("Erro ao remover usuário: " + (err.message || "Tente novamente"));
                                      }
                                    }
                                  }}
                                  className="text-xs text-red-500 opacity-50 hover:opacity-100 transition-opacity"
                                >Remover</button>
                             </div>
                           ))}
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Adicionar Novo Membro</label>
                          <select 
                            className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl font-bold"
                            onChange={async (e) => {
                              if (e.target.value && editingItem.data.id) {
                                try {
                                  await adminApi.addUserToGroup(e.target.value, editingItem.data.id);
                                  const updated = await adminApi.getGroupMembers(editingItem.data.id);
                                  setGroupMembers(updated);
                                  toast.success("Usuário adicionado com sucesso!");
                                  } catch (err: any) {
                                  toast.error("Erro ao adicionar: " + (err.message || "Usuário já pode fazer parte do bolão"));
                                }
                              }
                            }}
                          >
                            <option value="">Selecionar Profissional...</option>
                            {data.users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    <button type="submit" disabled={modalLoading} className="w-full py-5 bg-cyan-500 text-slate-900 font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-95 transition-all">
                      {modalLoading ? <RefreshCw size={20} className="animate-spin mx-auto" /> : editingItem.type === 'add_group' ? 'Criar Bolão' : 'Salvar Alterações'}
                    </button>
                  </form>
                )}

                {(editingItem.type === 'matches' || editingItem.type === 'add_match') && (
                  <form onSubmit={handleSaveMatch} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Time 1</label>
                        <input value={editingItem.data.team1 || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, team1: e.target.value } })} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl" placeholder="Ex: Brasil" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Time 2</label>
                        <input value={editingItem.data.team2 || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, team2: e.target.value } })} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl" placeholder="Ex: Argentina" required />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Data (YYYY-MM-DD)</label>
                        <input type="date" value={editingItem.data.date || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, date: e.target.value } })} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Hora</label>
                        <input type="time" value={editingItem.data.time || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, time: e.target.value } })} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl" required />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Placar Time 1</label>
                        <input 
                          type="number" 
                          value={editingItem.data.score1 !== null && editingItem.data.score1 !== undefined ? editingItem.data.score1 : ''} 
                          onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, score1: e.target.value === '' ? null : parseInt(e.target.value) } })} 
                          className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl" 
                          placeholder="Placar Real do Time 1" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Placar Time 2</label>
                        <input 
                          type="number" 
                          value={editingItem.data.score2 !== null && editingItem.data.score2 !== undefined ? editingItem.data.score2 : ''} 
                          onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, score2: e.target.value === '' ? null : parseInt(e.target.value) } })} 
                          className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl" 
                          placeholder="Placar Real do Time 2" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Time com mais Amarelos</label>
                        <select 
                          value={editingItem.data.yellow_cards_winner || ''} 
                          onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, yellow_cards_winner: e.target.value || null } })} 
                          className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl font-bold text-white focus:border-emerald-500 outline-none"
                        >
                          <option value="">Nenhum / Não Definido</option>
                          <option value={editingItem.data.team1}>{editingItem.data.team1}</option>
                          <option value="Empate">Empate</option>
                          <option value={editingItem.data.team2}>{editingItem.data.team2}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Teve Cartão Vermelho?</label>
                        <select 
                          value={editingItem.data.has_red_card === true ? 'true' : editingItem.data.has_red_card === false ? 'false' : ''} 
                          onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, has_red_card: e.target.value === 'true' ? true : e.target.value === 'false' ? false : null } })} 
                          className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl font-bold text-white focus:border-emerald-500 outline-none"
                        >
                          <option value="">Não Definido</option>
                          <option value="true">Sim</option>
                          <option value="false">Não</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Fase / Round</label>
                      <input value={editingItem.data.round || 'Matchday 1'} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, round: e.target.value } })} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl" required />
                    </div>
                    <button type="submit" disabled={modalLoading} className="w-full py-5 bg-amber-500 text-slate-900 font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all">
                      {modalLoading ? <RefreshCw size={20} className="animate-spin mx-auto" /> : 'Salvar Partida'}
                    </button>
                    {!editingItem.type.includes('add') && (
                      <button type="button" onClick={async () => {
                        if(confirm('Excluir partida permanentemente?')) {
                          await adminApi.deleteMatch(editingItem.data.id);
                          await fetchAllData();
                          setEditingItem(null);
                        }
                      }} className="w-full py-2 text-red-500 font-bold uppercase text-[10px] tracking-widest">Excluir Partida</button>
                    )}
                  </form>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                {stats.map((stat, i) => (
                  <div
                    key={stat.label}
                    className="glass p-8 rounded-[32px] flex items-center justify-between"
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{stat.label}</p>
                      <h3 className="text-4xl font-black tracking-tighter">{stat.value}</h3>
                    </div>
                    <div className={`w-12 h-12 bg-slate-900 ${stat.color} flex items-center justify-center rounded-xl shadow-inner`}>
                      <stat.icon size={24} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <section className="glass p-10 rounded-[40px]">
                  <h2 className="text-2xl font-black uppercase tracking-tighter mb-8">AÇÕES RÁPIDAS</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link 
                      href="/dashboard/api-football"
                      className="flex items-center gap-4 p-6 bg-slate-900 rounded-3xl border border-slate-800 hover:border-emerald-500/50 transition-all group"
                    >
                      <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-emerald-400">
                        <Plus size={20} />
                      </div>
                      <span className="font-bold text-xs uppercase tracking-widest text-left">Integração API-Football</span>
                    </Link>
                    <button 
                      onClick={handleSyncMatches}
                      disabled={isSyncing}
                      className="flex items-center gap-4 p-6 bg-slate-900 rounded-3xl border border-slate-800 hover:border-emerald-500/50 transition-all group disabled:opacity-50"
                    >
                      <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-emerald-400">
                        {isSyncing ? <RefreshCw size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                      </div>
                      <span className="font-bold text-xs uppercase tracking-widest text-left">Sincronizar Jogos</span>
                    </button>
                    <button 
                      onClick={handleSimulateResults}
                      disabled={isSyncing}
                      className="flex items-center gap-4 p-6 bg-slate-900 rounded-3xl border border-slate-800 hover:border-amber-500/50 transition-all group disabled:opacity-50"
                    >
                      <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-amber-400">
                        {isSyncing ? <RefreshCw size={20} className="animate-spin" /> : <Trophy size={20} />}
                      </div>
                      <span className="font-bold text-xs uppercase tracking-widest text-left">Simular Resultados</span>
                    </button>

                    <button 
                      onClick={handleExportGuesses}
                      disabled={isSyncing}
                      className="flex items-center gap-4 p-6 bg-slate-900 rounded-3xl border border-slate-800 hover:border-cyan-500/50 transition-all group disabled:opacity-50"
                    >
                      <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-cyan-400">
                        <Download size={20} />
                      </div>
                      <span className="font-bold text-xs uppercase tracking-widest text-left">Exportar Palpites</span>
                    </button>
                    <label 
                      className={`flex items-center gap-4 p-6 bg-slate-900 rounded-3xl border border-slate-800 hover:border-pink-500/50 transition-all group cursor-pointer ${isSyncing ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-pink-400">
                        <Upload size={20} />
                      </div>
                      <span className="font-bold text-xs uppercase tracking-widest text-left">Importar Palpites</span>
                      <input 
                        type="file" 
                        accept=".json" 
                        onChange={handleImportGuesses} 
                        className="hidden" 
                        disabled={isSyncing}
                      />
                    </label>
                    {/* Other actions could go here */}
                  </div>
                </section>

                <section className="glass p-10 rounded-[40px]">
                  <h2 className="text-2xl font-black uppercase tracking-tighter mb-8">ULTIMOS BOLÕES</h2>
                  <div className="space-y-4">
                    {data.groups.slice(0, 4).map(group => (
                      <div key={group.id} className="flex items-center justify-between p-5 bg-slate-950 rounded-2xl border border-slate-800 hover:border-emerald-500/30 cursor-pointer group" onClick={() => setEditingItem({ type: 'groups', data: group })}>
                        <div>
                          <p className="font-bold uppercase text-sm group-hover:text-emerald-400 transition-colors">{group.name}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Código: {group.code}</p>
                        </div>
                        <Edit size={18} className="text-slate-700" />
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass p-10 rounded-[40px]"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
                <h2 className="text-2xl font-black uppercase tracking-tighter">BASE DE USUÁRIOS</h2>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative">
                     <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                     <input type="text" placeholder="BUSCAR USUÁRIO..." className="pl-12 pr-6 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold focus:border-emerald-500 outline-none transition-all uppercase tracking-widest" />
                  </div>
                  <button 
                    onClick={() => setEditingItem({ type: 'add_user', data: { email: '', password: '', username: '', full_name: '' } })} 
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10"
                  >
                    <Plus size={14} /> Novo Usuário
                  </button>
                </div>
              </div>

              <div className="grid gap-4">
                {data.users.map(u => (
                  <div key={u.id} className="flex flex-col p-5 bg-slate-900/50 rounded-2xl border border-slate-700/50 group hover:border-emerald-500/30 transition-all gap-4">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center font-black text-emerald-400 border border-slate-700 shadow-inner uppercase">
                          {u.full_name?.charAt(0) || u.email?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-black text-white">{u.full_name || 'Sem Nome'}</p>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{u.email}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {(() => {
                              const groupPredsCount = getUserGroupPredictionsCount(u.id);
                              return (
                                <span className={`px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border ${
                                  groupPredsCount === 12 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                    : groupPredsCount > 0
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                      : 'bg-slate-950 text-slate-500 border-slate-800'
                                }`}>
                                  Classificação de Grupo: {groupPredsCount}/12 Grupos
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-12">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] font-black uppercase text-slate-600 tracking-tighter">Pontos</p>
                          <p className="font-black text-emerald-400">{u.points || 0}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingItem({ type: 'users', data: u })} className="p-3 text-slate-500 hover:text-white transition-colors"><Edit size={18} /></button>
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            disabled={isActionLoading === u.id}
                            className="p-3 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
                          >
                            {isActionLoading === u.id ? <RefreshCw size={18} className="animate-spin" /> : <Trash2 size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Progress grid per phase */}
                    <div className="mt-2 pt-4 border-t border-slate-800/60 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                      {['FASE DE GRUPOS', '16-AVOS DE FINAL', 'OITAVAS DE FINAL', 'QUARTAS DE FINAL', 'SEMIFINAIS', 'DISPUTA DO 3º LUGAR', 'FINAL'].map(phase => {
                        const total = phaseTotalMatches[phase] || 0;
                        if (total === 0) return null;
                        const completed = getUserProgressPerPhase(u.id)[phase] || 0;
                        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
                        return (
                          <div key={phase} className="bg-slate-950 p-2 rounded-xl border border-slate-800/50 text-center flex flex-col justify-between">
                            <p className="text-[7px] font-black text-slate-500 uppercase tracking-wider truncate" title={phase}>{phase}</p>
                            <div className="mt-1">
                              <p className="font-black text-[10px] text-slate-300">{completed}<span className="text-slate-600 text-[8px] font-bold">/{total}</span></p>
                              <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden mt-1 border border-slate-800">
                                <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {data.users.length === 0 && (
                  <div className="py-20 text-center opacity-50">
                    <Users size={48} className="mx-auto mb-4 text-slate-700" />
                    <p className="text-xs font-black uppercase tracking-[0.2em]">Nenhum usuário encontrado na tabela profiles</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'matches' && (
            <motion.div
              key="matches"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass p-10 rounded-[40px]"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
                <h2 className="text-2xl font-black uppercase tracking-tighter">JOGOS DA COPA</h2>
                <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
                  {/* Grouping Toggle */}
                  <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setMatchGroupBy('date')}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        matchGroupBy === 'date' ? 'bg-emerald-500 text-slate-900 shadow' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Por Data
                    </button>
                    <button
                      onClick={() => setMatchGroupBy('phase')}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        matchGroupBy === 'phase' ? 'bg-emerald-500 text-slate-900 shadow' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Por Fase
                    </button>
                  </div>

                  <button onClick={handleSyncMatches} className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} /> Recarregar
                  </button>
                  <button onClick={() => setEditingItem({ type: 'add_match', data: { team1: '', team2: '', date: '', time: '', round: 'Matchday 1' } })} className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-emerald-500 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all">
                    <Plus size={14} /> Novo Jogo
                  </button>
                </div>
              </div>

              {(() => {
                const renderMatchRow = (m: any) => (
                  <div key={m.id} className="flex flex-col md:flex-row items-center justify-between p-6 bg-slate-900/50 rounded-2xl border border-slate-800 group hover:border-amber-500/30 transition-all gap-6">
                    <div className="flex items-center gap-6 flex-1">
                      <div className="text-center min-w-[60px]">
                        <p className="text-xs font-black text-emerald-400">{formatMatchDate(m.date)}</p>
                        <p className="text-[10px] font-bold text-slate-500">{formatMatchTime(m.time)}</p>
                      </div>
                      <div className="flex items-center gap-4 flex-1">
                        <span className="font-black text-sm uppercase flex-1 text-right truncate">{m.team1}</span>
                        <div className="flex items-center gap-2">
                           <input type="text" value={m.score1 !== null && m.score1 !== undefined ? m.score1 : ''} className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-lg text-center font-bold text-amber-500 outline-none" readOnly />
                           <span className="text-slate-700 italic">X</span>
                           <input type="text" value={m.score2 !== null && m.score2 !== undefined ? m.score2 : ''} className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-lg text-center font-bold text-amber-500 outline-none" readOnly />
                        </div>
                        <span className="font-black text-sm uppercase flex-1 truncate">{m.team2}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-widest">{m.round}</span>
                       <button onClick={() => setEditingItem({ type: 'matches', data: m })} className="p-3 text-slate-500 hover:text-white"><Edit size={18} /></button>
                    </div>
                  </div>
                );

                return (
                  <div className="space-y-12">
                    {matchGroupBy === 'date' ? (
                      sortedMatchDates.map(dateStr => {
                        const matchesList = groupedMatchesByDate[dateStr];
                        const header = getFormattedDateHeader(dateStr);
                        return (
                          <div key={dateStr} className="space-y-4">
                            <div className="flex items-center gap-4">
                              <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest rounded-xl">
                                {header}
                              </span>
                              <div className="h-px flex-1 bg-slate-800/40" />
                            </div>
                            <div className="space-y-4">
                              {matchesList.map(renderMatchRow)}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      sortedMatchPhases.map(phaseName => {
                        const matchesList = groupedMatchesByPhase[phaseName];
                        return (
                          <div key={phaseName} className="space-y-4">
                            <div className="flex items-center gap-4">
                              <span className="px-4 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-black uppercase tracking-widest rounded-xl">
                                {phaseName}
                              </span>
                              <div className="h-px flex-1 bg-slate-800/40" />
                            </div>
                            <div className="space-y-4">
                              {matchesList.map(renderMatchRow)}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {data.matches.length === 0 && (
                      <div className="py-20 text-center opacity-50 border-2 border-dashed border-slate-800 rounded-[32px]">
                        <AlertTriangle size={48} className="mx-auto mb-4 text-amber-500/50" />
                        <p className="text-xs font-black uppercase tracking-[0.2em] mb-6">Tabela de jogos vazia</p>
                        <button onClick={handleSyncMatches} className="px-8 py-4 bg-emerald-500 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest">Sincronizar Dados Iniciais</button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {activeTab === 'groups' && (
             <motion.div
              key="groups"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass p-10 rounded-[40px]"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
                <h2 className="text-2xl font-black uppercase tracking-tighter">BOLÕES ATIVOS</h2>
                <div className="flex flex-wrap gap-2 sm:gap-4">
                   <button onClick={fetchAllData} className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Recarregar
                   </button>
                   <button onClick={() => setEditingItem({ type: 'add_group', data: { name: '', points_winner: 2, points_exact: 5, points_first_half: 2 } })} className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-cyan-500 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-400 transition-all">
                      <Plus size={14} /> Novo Bolão
                   </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {data.groups.map(group => (
                  <div key={group.id} className="p-8 bg-slate-900/50 rounded-[32px] border border-slate-800 group hover:border-cyan-500/30 transition-all">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-tight mb-1">{group.name}</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Código: <span className="text-cyan-400">{group.code}</span></p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingItem({ type: 'groups', data: group })} className="p-2 text-slate-500 hover:text-white"><Edit size={16} /></button>
                        <button 
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if(!confirm(`Deseja realmente excluir o bolão "${group.name}" permanentemente? Todos os membros serão desvinculados.`)) return;
                            
                            try {
                              console.log("DEBUG: Iniciando exclusão do grupo:", group.id);
                              await adminApi.deleteGroup(group.id);
                              toast.success("Bolão excluído com sucesso!");
                              // Delay refresh slightly to ensure DB consistency
                              setTimeout(() => fetchAllData(), 500);
                            } catch (err: any) {
                              console.error("Erro crítico ao excluir bolão:", err);
                              toast.error(`Falha ao excluir: ${err.message || 'Erro de conexão'}`);
                              // Fallback refresh
                              fetchAllData();
                            }
                          }}
                          className="p-3 text-slate-500 hover:text-red-400 bg-slate-950/50 rounded-xl border border-slate-800 hover:border-red-500/50 transition-all"
                          title="Excluir Bolão"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-6">
                       <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                          <p className="text-[8px] font-bold text-slate-500 uppercase">Vencedor</p>
                          <p className="font-black text-xs text-emerald-400">{group.points_winner || 0}</p>
                       </div>
                       <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                          <p className="text-[8px] font-bold text-slate-500 uppercase">Exato</p>
                          <p className="font-black text-xs text-cyan-400">{group.points_exact || 0}</p>
                       </div>
                       <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                          <p className="text-[8px] font-bold text-slate-500 uppercase">Tempo</p>
                          <p className="font-black text-xs text-amber-400">{group.points_first_half || 0}</p>
                       </div>
                    </div>
                    <div className="flex items-center justify-between pt-6 border-t border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       <span>Criador: {group.profiles?.email || 'Sistema'}</span>
                       <span className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors" onClick={() => setEditingItem({ type: 'groups', data: group })}>
                          <Users size={14} className="text-cyan-400" /> Gerenciar Membros
                       </span>
                    </div>
                  </div>
                ))}
                {data.groups.length === 0 && (
                   <div className="col-span-full py-20 text-center opacity-50">
                    <Trophy size={48} className="mx-auto mb-4 text-slate-700" />
                    <p className="text-xs font-black uppercase tracking-[0.2em]">Nenhum bolão criado ainda</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'standings' && (
            <motion.div
              key="standings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass p-10 rounded-[40px]"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">RESULTADO REAL DOS GRUPOS</h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Insira a classificação final oficial para cada grupo da Copa.
                  </p>
                </div>
                <button
                  onClick={handleForceRecalculatePoints}
                  disabled={isSyncing}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} /> Recalcular Pontuações
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map(groupLetter => {
                  const groupTeams = getTeamsByGroup(groupLetter);
                  const result = groupResults.find(r => r.group_letter === groupLetter) || { first_place: '', second_place: '', third_place: '', third_place_qualified: false };
                  const isSaving = savingStanding === groupLetter;

                  return (
                    <div 
                      key={groupLetter} 
                      className="p-6 bg-slate-900/50 rounded-3xl border border-slate-800 flex flex-col justify-between"
                    >
                      <div>
                        <h3 className="text-lg font-black text-white mb-4">GRUPO {groupLetter}</h3>
                        <div className="space-y-3">
                          {/* 1º Lugar */}
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest">1º Colocado</label>
                            <select
                              value={result.first_place || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setGroupResults(prev => prev.map(r => r.group_letter === groupLetter ? { ...r, first_place: val } : r));
                              }}
                              className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-bold text-xs text-white focus:border-emerald-500 outline-none"
                            >
                              <option value="">Não definido...</option>
                              {groupTeams.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>

                          {/* 2º Lugar */}
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest">2º Colocado</label>
                            <select
                              value={result.second_place || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setGroupResults(prev => prev.map(r => r.group_letter === groupLetter ? { ...r, second_place: val } : r));
                              }}
                              className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-bold text-xs text-white focus:border-emerald-500 outline-none"
                            >
                              <option value="">Não definido...</option>
                              {groupTeams.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>

                          {/* 3º Lugar */}
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-slate-500 tracking-widest">3º Colocado</label>
                            <select
                              value={result.third_place || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setGroupResults(prev => prev.map(r => r.group_letter === groupLetter ? { ...r, third_place: val } : r));
                              }}
                              className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-bold text-xs text-white focus:border-emerald-500 outline-none"
                            >
                              <option value="">Não definido...</option>
                              {groupTeams.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>

                          {/* Qualified switch */}
                          <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-900 mt-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">3º classificado?</span>
                            <button
                              type="button"
                              onClick={() => {
                                const curr = result.third_place_qualified || false;
                                setGroupResults(prev => prev.map(r => r.group_letter === groupLetter ? { ...r, third_place_qualified: !curr } : r));
                              }}
                              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                result.third_place_qualified
                                  ? 'bg-amber-500 text-slate-900 shadow-md shadow-amber-500/10'
                                  : 'bg-slate-900 text-slate-600 hover:text-slate-400'
                              }`}
                            >
                              {result.third_place_qualified ? 'Sim (Qualificou)' : 'Não'}
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSaveGroupResults(groupLetter, result.first_place, result.second_place, result.third_place, result.third_place_qualified)}
                        disabled={isSaving}
                        className="w-full mt-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSaving ? <RefreshCw size={12} className="animate-spin" /> : 'Salvar Grupo ' + groupLetter}
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
