'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Award, 
  HelpCircle, 
  Calendar, 
  CheckCircle, 
  AlertCircle,
  Copy,
  Info,
  Shield,
  TrendingUp,
  UserCheck,
  Zap,
  X,
  Sparkles
} from 'lucide-react';

export default function RulesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans">
      <Navbar />

      <main className="max-w-6xl mx-auto p-4 md:p-12">
        {/* Header Section */}
        <div className="text-center mb-12">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-4"
          >
            <BookOpen size={16} />
            <span className="text-xs font-black uppercase tracking-widest">Guia Oficial do Bolão</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-6xl font-black uppercase tracking-tighter bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent"
          >
            Regras & Pontuação
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-slate-400 text-sm md:text-base font-medium max-w-xl mx-auto mt-4"
          >
            Entenda como funciona o sistema de pontuação acumulativa e as previsões de grupos para liderar a tabela da Copa do Mundo FIFA 2026.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-6"
          >
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <Sparkles size={16} />
              Sugestões de Regras Personalizadas
            </button>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Rules and Points Summary Column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Seção 1: Pontuação por Jogo */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="glass p-6 md:p-8 rounded-[32px] border border-slate-700/50 space-y-6 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl" />
              
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <Zap size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-tight text-white">Pontuação por Partida</h2>
                  <p className="text-xs text-slate-400">Os pontos são acumulativos por jogo e dependem das suas previsões</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Placar Exato */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-emerald-500/30 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                      +5 Pontos
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-black">Principal</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Placar Exato</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você acerta a quantidade exata de gols marcados por ambas as seleções na partida.
                  </p>
                </div>

                {/* Vencedor / Empate */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-cyan-500/30 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-lg">
                      +2 Pontos
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-black">Resultado</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Resultado da Partida</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você acerta o vencedor do jogo ou que a partida terminará empatada, mas erra o placar exato.
                  </p>
                </div>

                {/* Cartões Amarelos */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-amber-500/30 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                      +3 Pontos
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-black">Extra</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Mais Cartões Amarelos</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Acerte qual equipe receberá o maior número de cartões amarelos ou se haverá empate de cartões.
                  </p>
                </div>

                {/* Cartão Vermelho */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-red-500/30 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-red-400 bg-red-400/10 px-2.5 py-1 rounded-lg">
                      +4 Pontos
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-black">Extra</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Cartão Vermelho na Partida</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Preveja se o jogo terá pelo menos um cartão vermelho (expulsão de jogador ou comissão técnica).
                  </p>
                </div>

              </div>

              {/* Dica de Acúmulo */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 flex gap-3 items-start">
                <Info className="text-emerald-400 shrink-0 mt-0.5" size={18} />
                <p className="text-xs text-slate-400 leading-relaxed">
                  <strong className="text-slate-200">Pontuação Acumulativa:</strong> Você pode faturar pontos combinando acertos. Por exemplo, acertando o <span className="text-white">Placar Exato (+5)</span>, os <span className="text-white">Cartões Amarelos (+3)</span> e o <span className="text-white">Cartão Vermelho (+4)</span>, você ganha incríveis <span className="text-emerald-400 font-bold">12 pontos em uma única partida!</span>
                </p>
              </div>
            </motion.section>

            {/* Seção 2: Classificação do Grupo */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="glass p-6 md:p-8 rounded-[32px] border border-slate-700/50 space-y-6 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl" />

              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                  <Award size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-tight text-white">Previsões de Grupos</h2>
                  <p className="text-xs text-slate-400">Pontos adicionais para palpites sobre a classificação final da fase de grupos</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1º e 2º Lugares */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-cyan-500/30 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-lg">
                      +5 Pontos
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-black">Combo</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">1º & 2º Colocados</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você acerta exatamente quais seleções terminam na 1ª e na 2ª posição na ordem correta.
                  </p>
                </div>

                {/* Apenas 1º Lugar */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg">
                      +3 Pontos
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-black">Posição</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Apenas 1º Lugar</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você acerta a seleção que lidera o grupo, mas erra o segundo colocado.
                  </p>
                </div>

                {/* Apenas 2º Lugar */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg">
                      +2 Pontos
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-black">Posição</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Apenas 2º Lugar</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você acerta a seleção que avança na vice-liderança, mas erra o líder do grupo.
                  </p>
                </div>

                {/* Melhor 3º Classificado */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-amber-500/30 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg">
                      +1 Ponto
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-black">Repescagem</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Melhor 3º Qualificado</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você prevê o 3º lugar do grupo e a seleção se classifica para o mata-mata como um dos melhores terceiros colocados.
                  </p>
                </div>

              </div>
            </motion.section>

          </div>

          {/* Sidebar Guidelines Column */}
          <div className="space-y-8">
            
            {/* Prazos e Regras Importantes */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="glass p-6 md:p-8 rounded-[32px] border border-slate-700/50 space-y-6"
            >
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                  <Calendar size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-tight text-white">Regras de Bloqueio</h2>
                  <p className="text-xs text-slate-400">Evite perder a oportunidade de palpitar</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 text-xs font-black">
                    !
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">Bloqueio antes do Apito</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Os palpites de cada jogo são trancados automaticamente no horário de início oficial da partida. Você pode alterar seu chute até o último segundo pré-jogo.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 text-xs font-black">
                    !
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">Palpites de Grupo</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      As previsões de classificação dos grupos devem ser submetidas antes da segunda rodada de jogos da respectiva chave.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 text-xs font-bold">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">Critério de Desempate</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Se dois usuários terminarem com a mesma pontuação global, a classificação priorizará quem possui mais acertos de placares exatos (+5), seguido por maior pontuação nas rodadas de mata-mata.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Como Usar / Dicas */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="glass p-6 md:p-8 rounded-[32px] border border-slate-700/50 space-y-6"
            >
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
                  <Shield size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-tight text-white">Dicas Estratégicas</h2>
                  <p className="text-xs text-slate-400">Dicas para otimizar suas chances</p>
                </div>
              </div>

              <ul className="space-y-3 text-xs text-slate-400 list-disc list-inside leading-relaxed">
                <li>
                  <strong className="text-slate-200">Acompanhe estatísticas:</strong> Dê uma olhada no histórico dos confrontos passados antes de preencher o placar.
                </li>
                <li>
                  <strong className="text-slate-200">Gerencie seus cartões:</strong> Partidas pegadas e com alta rivalidade costumam ter mais cartões e expulsões.
                </li>
                <li>
                  <strong className="text-slate-200">Fase de grupos importa:</strong> Os pontos de palpites de grupo são creditados assim que a fase de grupos se encerra oficialmente.
                </li>
                <li>
                  <strong className="text-slate-200">Crie seus bolões:</strong> Convide seus amigos criando um bolão privado na página de <span className="text-emerald-400 font-semibold">Bolões</span> para disputas paralelas.
                </li>
              </ul>
            </motion.div>

          </div>

        </div>
      </main>

      {/* Sugestões de Regras Popup Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#1E293B] border border-slate-700/80 rounded-[32px] w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl relative flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 md:p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-tight">Ideias de Regras Personalizadas</h2>
                    <p className="text-xs text-slate-400">Adicione ou remova pontos para tornar a disputa do seu bolão particular mais acirrada</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* 1. Zebra da Rodada */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                        +3 Pontos
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Bônus</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Zebra da Rodada</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Pontos extras para quem acertar a vitória de uma seleção com ranking significativamente inferior (ex: vitória sobre cabeça de chave).
                    </p>
                  </div>

                  {/* 2. Placar Invertido */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 px-2 py-0.5 rounded-lg">
                        -1 Ponto
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Penalidade</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Placar Invertido</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Se você apostar 2x1 para o Time A e o jogo acabar 2x1 para o Time B. Você acertou a quantidade de gols, mas errou totalmente o vencedor.
                    </p>
                  </div>

                  {/* 3. Goleada Histórica */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                        +4 Pontos
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Ataque</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Goleada Histórica</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Acertar a ocorrência de uma partida com alta média de gols (ex: 5 ou mais gols no total da partida).
                    </p>
                  </div>

                  {/* 4. Defesa de Paredão */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                        +2 Pontos
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Defesa</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Defesa de Paredão (Clean Sheet)</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Ganhe pontos por prever corretamente que uma seleção sairá de campo sem sofrer nenhum gol.
                    </p>
                  </div>

                  {/* 5. Primeiro a Marcar */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                        +2 Pontos
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Time</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Primeiro a Marcar</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Adicione uma previsão extra sobre qual time fará o primeiro gol do confronto.
                    </p>
                  </div>

                  {/* 6. Gol Contra */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                        +3 Pontos
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Mala Suerte</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Predizer Gol Contra</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Prever que a partida terá pelo menos um gol contra anotado na súmula oficial da FIFA.
                    </p>
                  </div>

                  {/* 7. Disputa por Pênaltis */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                        +3 Pontos
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Mata-Mata</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Caminho dos Pênaltis</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Prever se a partida de eliminação direta terminará empatada após a prorrogação e irá para a disputa de pênaltis.
                    </p>
                  </div>

                  {/* 8. Cartão Vermelho Direto */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                        +2 Pontos
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Fair Play</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Vermelho Direto</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Pontos extras para quem acertar se haverá expulsão direta (cartão vermelho sem dois amarelos prévios).
                    </p>
                  </div>

                  {/* 9. Erro Completo (Chute Errante) */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 px-2 py-0.5 rounded-lg">
                        -2 Pontos
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Penalidade</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Chute Errante</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Perda de pontos caso o usuário erre absolutamente tudo de uma partida: vencedor, quantidade de gols, cartões e expulsão.
                    </p>
                  </div>

                  {/* 10. Placar Simétrico */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                        +2 Pontos
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Equilíbrio</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Placar Simétrico</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Acertar empates com gols (como 2x2 ou 3x3) ao invés do tradicional e mais comum 0x0 ou 1x1.
                    </p>
                  </div>

                  {/* 11. Substituição Milagrosa */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 md:col-span-2">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                        +2 Pontos
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Tática</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Substituição Milagrosa</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Pontuação extra caso o gol decisivo ou da vitória seja marcado por um jogador que começou a partida no banco de reservas.
                    </p>
                  </div>

                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-800 bg-slate-900/30 flex justify-end">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
