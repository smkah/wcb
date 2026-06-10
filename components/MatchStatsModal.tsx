'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { X, RefreshCw, Lock, BarChart2, Users, AlertCircle, HelpCircle, Newspaper, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface MatchStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: any;
}

export default function MatchStatsModal({ isOpen, onClose, match }: MatchStatsModalProps) {
  const [guesses, setGuesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'guesses' | 'news'>('stats');
  const [news, setNews] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    const fetchGuesses = async () => {
      if (!isOpen || !match?.id) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('guesses')
          .select('*, profiles(id, email, full_name, username, avatar_url)')
          .eq('match_id', match.id);

        if (error) throw error;
        setGuesses(data || []);
      } catch (err) {
        console.error('Error fetching match guesses:', err);
        toast.error('Erro ao buscar estatísticas de palpites');
      } finally {
        setLoading(false);
      }
    };

    fetchGuesses();
  }, [isOpen, match]);

  useEffect(() => {
    const fetchNews = async () => {
      if (!isOpen || activeTab !== 'news' || !match?.team1) return;
      setNewsLoading(true);
      try {
        const res = await fetch(`/api/news?team1=${encodeURIComponent(match.team1)}&team2=${encodeURIComponent(match.team2 || '')}`);
        if (!res.ok) throw new Error('Falha ao buscar notícias');
        const data = await res.json();
        setNews(data.articles || []);
      } catch (err) {
        console.error('Error fetching news:', err);
        toast.error('Erro ao buscar últimas notícias');
      } finally {
        setNewsLoading(false);
      }
    };

    fetchNews();
  }, [isOpen, activeTab, match]);

  if (!isOpen || !match) return null;

  const isMatchStarted = () => {
    if (!match?.date) return false;
    const timePart = match.time ? match.time.split(' ')[0] : '00:00';
    const matchDateTime = new Date(`${match.date}T${timePart}`);
    return new Date() > matchDateTime;
  };

  const started = isMatchStarted();

  // Calcular Estatísticas Globais
  const totalGuesses = guesses.length;
  let win1Count = 0;
  let drawCount = 0;
  let win2Count = 0;
  let totalGoals1 = 0;
  let totalGoals2 = 0;
  let redCardSimCount = 0;
  let yellowTeam1Count = 0;
  let yellowEmpateCount = 0;
  let yellowTeam2Count = 0;

  guesses.forEach(g => {
    if (g.score1 > g.score2) win1Count++;
    else if (g.score1 < g.score2) win2Count++;
    else drawCount++;

    totalGoals1 += g.score1 || 0;
    totalGoals2 += g.score2 || 0;

    if (g.has_red_card === true) redCardSimCount++;

    if (g.yellow_cards_winner === match.team1) yellowTeam1Count++;
    else if (g.yellow_cards_winner === 'Empate') yellowEmpateCount++;
    else if (g.yellow_cards_winner === match.team2) yellowTeam2Count++;
  });

  const getPercent = (count: number) => {
    if (totalGuesses === 0) return 0;
    return Math.round((count / totalGuesses) * 100);
  };

  const avgGoals1 = totalGuesses > 0 ? (totalGoals1 / totalGuesses).toFixed(1) : '0';
  const avgGoals2 = totalGuesses > 0 ? (totalGoals2 / totalGuesses).toFixed(1) : '0';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="glass w-full max-w-3xl rounded-[32px] overflow-hidden border border-slate-800 flex flex-col max-h-[85vh] shadow-2xl shadow-emerald-500/5"
        >
          {/* Header */}
          <div className="p-6 sm:p-8 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between relative">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">Estatísticas e Auditoria</p>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight mt-1 text-white">
                {match.team1} <span className="text-slate-500 italic">vs</span> {match.team2}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Subtabs */}
          <div className="flex bg-slate-950/20 px-6 sm:px-8 border-b border-slate-800 gap-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('stats')}
              className={`py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'stats' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <BarChart2 size={14} /> Estatísticas Globais
            </button>
            <button
              onClick={() => setActiveTab('guesses')}
              className={`py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'guesses' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Users size={14} /> Palpites do Grupo
            </button>
            <button
              onClick={() => setActiveTab('news')}
              className={`py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'news' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Newspaper size={14} /> Últimas Notícias
            </button>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
            {activeTab === 'news' ? (
              <div className="space-y-4">
                {newsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <RefreshCw size={36} className="animate-spin text-emerald-500 mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Buscando Últimas Notícias...</p>
                  </div>
                ) : news.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <AlertCircle className="text-slate-700 mb-3" size={48} />
                    <p className="text-sm font-bold text-slate-400">Nenhuma notícia recente encontrada.</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">
                      Pesquise mais tarde por novidades sobre {match.team1} vs {match.team2}.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {news.map((item, idx) => (
                      <a
                        key={idx}
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="glass p-5 rounded-2xl border border-slate-800/80 hover:border-emerald-500/30 hover:bg-slate-900/10 transition-all flex flex-col justify-between group cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                              {item.source}
                            </span>
                            <span className="text-[9px] font-bold text-slate-500">{item.date}</span>
                          </div>
                          <h4 className="font-bold text-sm text-slate-200 group-hover:text-white transition-colors line-clamp-2 leading-relaxed">
                            {item.title}
                          </h4>
                        </div>
                        <div className="mt-4 flex items-center justify-end gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-400 transition-colors">
                          Ler notícia completa <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ) : loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <RefreshCw size={36} className="animate-spin text-emerald-500 mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Calculando Palpites...</p>
              </div>
            ) : totalGuesses === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <AlertCircle className="text-slate-700 mb-3" size={48} />
                <p className="text-sm font-bold text-slate-400">Nenhum palpite para esta partida ainda.</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Seja o primeiro a enviar seu palpite!</p>
              </div>
            ) : activeTab === 'stats' ? (
              <div className="space-y-8">
                {/* Distribuição de Vencedor */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Distribuição de Resultados ({totalGuesses} palpites)</h3>
                  <div className="space-y-3">
                    {/* Time 1 */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                        <span>Vitória {match.team1}</span>
                        <span>{getPercent(win1Count)}% ({win1Count})</span>
                      </div>
                      <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${getPercent(win1Count)}%` }} />
                      </div>
                    </div>
                    {/* Empate */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                        <span>Empate</span>
                        <span>{getPercent(drawCount)}% ({drawCount})</span>
                      </div>
                      <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div className="h-full bg-slate-500 rounded-full transition-all duration-500" style={{ width: `${getPercent(drawCount)}%` }} />
                      </div>
                    </div>
                    {/* Time 2 */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                        <span>Vitória {match.team2}</span>
                        <span>{getPercent(win2Count)}% ({win2Count})</span>
                      </div>
                      <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div className="h-full bg-cyan-500 rounded-full transition-all duration-500" style={{ width: `${getPercent(win2Count)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Média de Gols e Cartões */}
                  <div className="p-5 bg-slate-900/30 rounded-2xl border border-slate-800 flex flex-col justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Placar Médio Previsto</h4>
                    <div className="flex items-center justify-center gap-6 py-2">
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-400 truncate max-w-[90px]">{match.team1}</p>
                        <p className="text-4xl font-black text-emerald-400 mt-1">{avgGoals1}</p>
                      </div>
                      <span className="font-black text-slate-700 italic text-xl">X</span>
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-400 truncate max-w-[90px]">{match.team2}</p>
                        <p className="text-4xl font-black text-cyan-400 mt-1">{avgGoals2}</p>
                      </div>
                    </div>
                  </div>

                  {/* Estatísticas de Cartões */}
                  <div className="p-5 bg-slate-900/30 rounded-2xl border border-slate-800 space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Previsões de Cartões</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-400">Cartão Vermelho (Sim):</span>
                        <span className="font-black text-red-400">{getPercent(redCardSimCount)}%</span>
                      </div>
                      <div className="h-px bg-slate-800" />
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Mais Amarelos</p>
                        <div className="grid grid-cols-3 gap-1.5 text-center mt-1">
                          <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                            <p className="text-[8px] font-bold text-slate-500 uppercase truncate">{match.team1.substring(0,3)}</p>
                            <p className="text-xs font-black text-white mt-0.5">{getPercent(yellowTeam1Count)}%</p>
                          </div>
                          <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                            <p className="text-[8px] font-bold text-slate-500 uppercase">Empate</p>
                            <p className="text-xs font-black text-white mt-0.5">{getPercent(yellowEmpateCount)}%</p>
                          </div>
                          <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                            <p className="text-[8px] font-bold text-slate-500 uppercase truncate">{match.team2.substring(0,3)}</p>
                            <p className="text-xs font-black text-white mt-0.5">{getPercent(yellowTeam2Count)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Coluna 2: Palpites do Grupo (Auditoria)
              <div>
                {!started ? (
                  // Bloqueado se o jogo não iniciou
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 bg-slate-900 rounded-3xl border border-slate-800 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/5 mb-6">
                      <Lock size={28} className="animate-pulse" />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-white mb-2">Palpites Ocultos</h3>
                    <p className="text-slate-400 text-xs font-medium max-w-sm px-6 leading-relaxed">
                      Para manter a integridade do bolão e evitar cópias, os palpites de outros usuários estarão abertos para consulta **assim que o jogo iniciar**.
                    </p>
                  </div>
                ) : (
                  // Exibe os palpites pós-jogo
                  <div className="space-y-3">
                    {guesses.map((g, idx) => (
                      <div key={idx} className="glass p-4 rounded-2xl flex items-center justify-between border border-slate-800/80">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center font-black text-emerald-400 uppercase overflow-hidden">
                            {g.profiles?.avatar_url ? (
                              <img src={g.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              g.profiles?.full_name?.charAt(0) || g.profiles?.email?.charAt(0) || '?'
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-black text-white">{g.profiles?.full_name || g.profiles?.email?.split('@')[0]}</p>
                              {g.profiles?.username && (
                                <span className="text-[10px] font-bold text-emerald-400">@{g.profiles.username}</span>
                              )}
                            </div>
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                              {g.yellow_cards_winner ? `MA: ${g.yellow_cards_winner.substring(0,3).toUpperCase()}` : 'MA: -'} • 
                              {g.has_red_card === true ? ' CV: Sim' : g.has_red_card === false ? ' CV: Não' : ' CV: -'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="bg-slate-900 border border-slate-800/80 px-4 py-2 rounded-xl text-center min-w-[70px]">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Palpite</p>
                            <p className="text-sm font-black text-white mt-0.5">{g.score1} x {g.score2}</p>
                          </div>
                          {match.score1 !== null && match.score2 !== null && (
                            <div className="text-right">
                              <span className="text-xs font-black text-emerald-400">+{g.points_earned || 0} pts</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
