'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { motion } from 'motion/react';
import { Search, RefreshCw, Key, ShieldAlert, Award, Calendar, AlertTriangle, ArrowRightLeft, Check, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// Dicionário de mapeamento para compatibilidade de nomes de seleções
const TEAM_NAME_MAPPING: Record<string, string> = {
  'usa': 'EUA',
  'united states': 'EUA',
  'brazil': 'Brasil',
  'belgium': 'Bélgica',
  'egypt': 'Egito',
  'iran': 'Irã',
  'new zealand': 'Nova Zelândia',
  'spain': 'Espanha',
  'cape verde': 'Cabo Verde',
  'saudi arabia': 'Arábia Saudita',
  'uruguay': 'Uruguai',
  'france': 'França',
  'iraq': 'Iraque',
  'norway': 'Noruega',
  'algeria': 'Argélia',
  'austria': 'Áustria',
  'jordan': 'Jordânia',
  'dr congo': 'RD Congo',
  'congo dr': 'RD Congo',
  'uzbekistan': 'Uzbequistão',
  'colombia': 'Colômbia',
  'england': 'Inglaterra',
  'croatia': 'Croácia',
  'ghana': 'Gana',
  'panama': 'Panamá',
  'mexico': 'México',
  'south africa': 'África do Sul',
  'south korea': 'Coreia do Sul',
  'korea republic': 'Coreia do Sul',
  'czech republic': 'República Tcheca',
  'canada': 'Canadá',
  'bosnia': 'Bósnia e Herzegovina',
  'bosnia & herzegovina': 'Bósnia e Herzegovina',
  'qatar': 'Catar',
  'switzerland': 'Suíça',
  'morocco': 'Marrocos',
  'scotland': 'Escócia',
  'australia': 'Austrália',
  'turkey': 'Turquia',
  'germany': 'Alemanha',
  'curacao': 'Curaçao',
  'ivory coast': 'Costa do Marfim',
  'ecuador': 'Equador',
  'netherlands': 'Países Baixos',
  'japan': 'Japão',
  'sweden': 'Suécia',
  'tunisia': 'Tunísia',
  'senegal': 'Senegal',
  'portugal': 'Portugal',
};

function normalizeName(name: string): string {
  const clean = name.toLowerCase().trim();
  if (TEAM_NAME_MAPPING[clean]) return TEAM_NAME_MAPPING[clean];
  return name;
}

export default function ApiFootballPage() {
  const [apiKey, setApiKey] = useState<string>('');
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [localMatches, setLocalMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'finished' | 'scheduled'>('all');
  const [user, setUser] = useState<any>(null);
  const [syncingMatchId, setSyncingMatchId] = useState<string | null>(null);

  useEffect(() => {
    // Carrega chave salva do localStorage, se existir
    const savedKey = localStorage.getItem('api_football_key');
    if (savedKey) setApiKey(savedKey);

    // Carrega usuário atual do Supabase
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Carrega partidas locais do banco de dados
    fetchLocalMatches();
  }, []);

  const fetchLocalMatches = async () => {
    try {
      const { data, error } = await supabase.from('matches').select('*');
      if (!error && data) {
        setLocalMatches(data);
      }
    } catch (err) {
      console.error('Erro ao buscar partidas locais:', err);
    }
  };

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('api_football_key', apiKey);
    toast.success('Chave da API-Football salva localmente!');
  };

  const handleFetchFixtures = async () => {
    if (!apiKey) {
      toast.error('Insira a sua chave da API-Football primeiro!');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/football?league=1&season=2026', {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro na resposta do servidor');
      }

      const data = await res.json();
      if (data.errors && Object.keys(data.errors).length > 0) {
        throw new Error(JSON.stringify(data.errors));
      }

      if (data.response) {
        setFixtures(data.response);
        toast.success(`Carregadas ${data.response.length} partidas da API-Football!`);
      } else {
        setFixtures([]);
        toast.warning('Nenhuma partida encontrada.');
      }
    } catch (err: any) {
      toast.error('Falha ao buscar partidas: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.email === 'samukahweb@gmail.com';

  // Encontra a partida local que corresponde ao jogo retornado pela API
  const findMatchingLocalMatch = (apiFixture: any) => {
    const apiTeam1Norm = normalizeName(apiFixture.teams.home.name);
    const apiTeam2Norm = normalizeName(apiFixture.teams.away.name);

    return localMatches.find((local) => {
      const localTeam1Norm = normalizeName(local.team1);
      const localTeam2Norm = normalizeName(local.team2);

      return (
        (localTeam1Norm === apiTeam1Norm && localTeam2Norm === apiTeam2Norm) ||
        (localTeam1Norm === apiTeam2Norm && localTeam2Norm === apiTeam1Norm)
      );
    });
  };

  const handleSyncScore = async (apiFixture: any, localMatch: any) => {
    if (!isAdmin) {
      toast.error('Apenas administradores podem sincronizar os placares!');
      return;
    }

    setSyncingMatchId(localMatch.id);
    try {
      const goalsHome = apiFixture.goals.home;
      const goalsAway = apiFixture.goals.away;

      const isTeamsInverted = normalizeName(localMatch.team1) !== normalizeName(apiFixture.teams.home.name);
      
      const score1 = isTeamsInverted ? goalsAway : goalsHome;
      const score2 = isTeamsInverted ? goalsHome : goalsAway;

      if (score1 === null || score2 === null) {
        toast.error('Placar ainda não disponível na API-Football para este jogo.');
        return;
      }

      const { error } = await supabase
        .from('matches')
        .update({
          score1,
          score2,
          updated_at: new Date().toISOString(),
        })
        .eq('id', localMatch.id);

      if (error) throw error;

      // Recalcula pontos dos usuários afetados pelo novo placar
      const { error: recalcError } = await supabase.rpc('recalculate_all_user_points');
      if (recalcError) console.error('Erro ao recalcular pontos:', recalcError);

      toast.success(`Placar sincronizado: ${localMatch.team1} ${score1} - ${score2} ${localMatch.team2}!`);
      await fetchLocalMatches();
    } catch (err: any) {
      toast.error('Erro ao sincronizar placar: ' + err.message);
    } finally {
      setSyncingMatchId(null);
    }
  };

  // Filtra as partidas baseando-se no input e no status
  const filteredFixtures = fixtures.filter((f) => {
    const homeTeam = f.teams.home.name.toLowerCase();
    const awayTeam = f.teams.away.name.toLowerCase();
    const cleanSearch = search.toLowerCase();
    const matchesSearch = homeTeam.includes(cleanSearch) || awayTeam.includes(cleanSearch);

    if (!matchesSearch) return false;

    const statusShort = f.fixture.status.short;
    if (statusFilter === 'live') {
      return ['1H', 'HT', '2H', 'ET', 'P', 'BT'].includes(statusShort);
    }
    if (statusFilter === 'finished') {
      return ['FT', 'AET', 'PEN'].includes(statusShort);
    }
    if (statusFilter === 'scheduled') {
      return ['NS', 'TBD'].includes(statusShort);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100">
      <Navbar />

      <main className="max-w-7xl mx-auto p-4 md:p-12">
        <header className="mb-12">
          <div className="flex items-center gap-3 text-emerald-400 mb-2">
            <Sparkles size={16} />
            <p className="text-xs font-bold uppercase tracking-[0.3em]">Resultados Oficial FIFA</p>
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
            INTEGRADOR <span className="gradient-text italic">API-FOOTBALL</span>
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
            Consulte placares oficiais da Copa do Mundo 2026 e sincronize com a base de dados local.
          </p>
        </header>

        {/* Form para salvar chave */}
        <section className="glass p-6 md:p-8 rounded-[32px] border-emerald-500/20 mb-8 max-w-2xl">
          <form onSubmit={handleSaveKey} className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <Key size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Configuração de Credencial</h3>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed">
              Forneça sua chave da API-Football (RapidAPI) para realizar consultas em tempo real. A chave ficará guardada de forma segura em seu navegador.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Insira sua Chave da API"
                className="flex-1 bg-slate-900 border border-slate-800 p-3.5 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 transition-all placeholder:text-slate-600"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/10 shrink-0"
              >
                Salvar Chave
              </button>
            </div>
          </form>
        </section>

        {/* Botão de carregamento e filtros */}
        <section className="flex flex-col gap-6 mb-12">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handleFetchFixtures}
              disabled={loading || !apiKey}
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-500/15 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              BUSCAR PARTIDAS DA API
            </button>
          </div>

          {fixtures.length > 0 && (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-3xl border border-slate-800/80">
              {/* Filtro por Nome */}
              <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-2xl border border-slate-850 w-full md:max-w-xs">
                <Search size={16} className="text-slate-500" />
                <input
                  type="text"
                  placeholder="Filtrar por seleção..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-100 outline-none w-full placeholder:text-slate-600"
                />
              </div>

              {/* Filtro por status */}
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-850">
                {[
                  { value: 'all', label: 'TODOS' },
                  { value: 'live', label: 'AO VIVO' },
                  { value: 'finished', label: 'FINALIZADOS' },
                  { value: 'scheduled', label: 'AGENDADOS' }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStatusFilter(opt.value as any)}
                    className={`px-4 py-2 rounded-xl text-[9px] font-black tracking-widest transition-all ${
                      statusFilter === opt.value
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Lista de Partidas retornadas */}
        <section className="space-y-6">
          {fixtures.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-slate-800 rounded-[32px] flex flex-col items-center justify-center gap-3">
              <Calendar size={48} className="text-slate-700" />
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nenhuma partida carregada</p>
              <p className="text-xs text-slate-600 font-bold uppercase tracking-wider max-w-sm leading-relaxed">
                Preencha sua chave de acesso acima e clique em "BUSCAR PARTIDAS DA API" para puxar as tabelas.
              </p>
            </div>
          ) : filteredFixtures.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-slate-800 rounded-[32px]">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nenhum resultado corresponde aos filtros aplicados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredFixtures.map((item) => {
                const localMatch = findMatchingLocalMatch(item);
                const isLive = ['1H', 'HT', '2H', 'ET', 'P', 'BT'].includes(item.fixture.status.short);
                const isFinished = ['FT', 'AET', 'PEN'].includes(item.fixture.status.short);

                return (
                  <motion.div
                    key={item.fixture.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass p-6 rounded-[28px] border-slate-800/80 flex flex-col justify-between gap-5 group hover:border-emerald-500/20 transition-all"
                  >
                    {/* Header do Card */}
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                      <div className="flex items-center gap-2">
                        {isLive ? (
                          <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[8px] font-black rounded-lg uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            AO VIVO - {item.fixture.status.elapsed}'
                          </span>
                        ) : isFinished ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-black rounded-lg uppercase tracking-widest">
                            FINALIZADO
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-900 text-slate-500 border border-slate-800 text-[8px] font-black rounded-lg uppercase tracking-widest">
                            AGENDADO
                          </span>
                        )}
                        <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">
                          ID: {item.fixture.id}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        {item.league.round}
                      </span>
                    </div>

                    {/* Confronto e Placares */}
                    <div className="flex items-center justify-between gap-4 py-2">
                      {/* Home */}
                      <div className="flex flex-col items-center gap-2 flex-1 text-center">
                        {item.teams.home.logo && (
                          <img src={item.teams.home.logo} alt="" className="w-10 h-10 object-contain drop-shadow" />
                        )}
                        <span className="text-xs font-black uppercase tracking-tight text-white line-clamp-1">{item.teams.home.name}</span>
                      </div>

                      {/* Score */}
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-white w-8 text-center bg-slate-900/60 py-1.5 rounded-xl border border-slate-850">
                          {item.goals.home !== null ? item.goals.home : '-'}
                        </span>
                        <span className="text-xs font-black text-slate-700 italic">X</span>
                        <span className="text-2xl font-black text-white w-8 text-center bg-slate-900/60 py-1.5 rounded-xl border border-slate-850">
                          {item.goals.away !== null ? item.goals.away : '-'}
                        </span>
                      </div>

                      {/* Away */}
                      <div className="flex flex-col items-center gap-2 flex-1 text-center">
                        {item.teams.away.logo && (
                          <img src={item.teams.away.logo} alt="" className="w-10 h-10 object-contain drop-shadow" />
                        )}
                        <span className="text-xs font-black uppercase tracking-tight text-white line-clamp-1">{item.teams.away.name}</span>
                      </div>
                    </div>

                    {/* Mapeamento e Ação de Sync */}
                    <div className="border-t border-slate-800/60 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      {localMatch ? (
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                            <Check size={10} /> Associado a partida local
                          </p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            Banco local: <strong className="text-slate-400">{localMatch.team1} {localMatch.score1 !== null ? localMatch.score1 : '-'} x {localMatch.score2 !== null ? localMatch.score2 : '-'} {localMatch.team2}</strong>
                          </p>
                        </div>
                      ) : (
                        <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1">
                          <AlertTriangle size={10} /> Partida local não encontrada
                        </p>
                      )}

                      {isAdmin && localMatch && (isLive || isFinished) && (
                        <button
                          onClick={() => handleSyncScore(item, localMatch)}
                          disabled={syncingMatchId !== null}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1 shrink-0"
                        >
                          {syncingMatchId === localMatch.id ? (
                            <RefreshCw size={10} className="animate-spin" />
                          ) : (
                            <ArrowRightLeft size={10} />
                          )}
                          Sincronizar Placar
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
