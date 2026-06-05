'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { 
  Trophy, 
  Users, 
  TrendingUp, 
  ChevronRight, 
  Globe, 
  Zap, 
  ShieldCheck, 
  MapPin,
  Flame
} from 'lucide-react';

import Flag from 'react-world-flags';

export default function LandingPage() {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isFinished: boolean;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isFinished: false,
  });

  useEffect(() => {
    const targetDate = new Date('2026-06-11T13:00:00-06:00');

    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isFinished: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, isFinished: false });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#050B1A] text-slate-100 selection:bg-emerald-500 selection:text-black">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-700/10 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between p-4 md:p-6">
          <Link id="nav-logo" href="/" className="flex items-center gap-3 active:scale-95 transition-transform">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 rotate-3">
              <Trophy size={20} className="text-black fill-black" />
            </div>
            <span className="text-xl font-black uppercase tracking-tighter italic">BOLÃO<span className="text-emerald-400">2026</span></span>
          </Link>
          
          <div className="flex items-center gap-3">
            <Link id="nav-login" href="/login" className="hidden md:block px-6 py-2 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
              Acesso
            </Link>
            <Link id="nav-cta" href="/login?mode=signup" className="px-6 py-3 bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-full hover:bg-emerald-400 transition-all active:scale-90 shadow-xl shadow-white/5">
              Começar Agora
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center mb-20"
          >
            <div className="mb-6 flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <Flame size={14} className="text-emerald-400 fill-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">O Maior de Todos os Tempos</span>
            </div>
            
            <h1 className="text-[12vw] md:text-[8vw] font-black leading-[0.8] tracking-tighter uppercase mb-8">
              TRÊS <span className="gradient-text">NAÇÕES</span><br />
              UM <span className="italic outline-text">DESTINO</span>
            </h1>

            <p className="text-slate-400 text-sm md:text-lg max-w-xl font-bold uppercase tracking-widest leading-relaxed mb-12 opacity-80">
              48 Seleções. 16 Cidades. <br />
              Um único lugar para provar quem manda no futebol.
            </p>

            {/* Countdown Timer */}
            {!timeLeft.isFinished && (
              <div className="mb-12 flex flex-col items-center">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-500/70 mb-4">CONTAGEM REGRESSIVA PARA O INÍCIO</span>
                <div className="flex gap-4 md:gap-6 justify-center">
                  <div className="glass px-4 py-3 md:px-6 md:py-4 rounded-2xl min-w-[70px] md:min-w-[90px] border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                    <div className="text-2xl md:text-4xl font-black text-emerald-400 font-mono tracking-tighter">
                      {String(timeLeft.days).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1">Dias</div>
                  </div>
                  <div className="glass px-4 py-3 md:px-6 md:py-4 rounded-2xl min-w-[70px] md:min-w-[90px] border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                    <div className="text-2xl md:text-4xl font-black text-emerald-400 font-mono tracking-tighter">
                      {String(timeLeft.hours).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1">Horas</div>
                  </div>
                  <div className="glass px-4 py-3 md:px-6 md:py-4 rounded-2xl min-w-[70px] md:min-w-[90px] border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                    <div className="text-2xl md:text-4xl font-black text-emerald-400 font-mono tracking-tighter">
                      {String(timeLeft.minutes).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1">Minutos</div>
                  </div>
                  <div className="glass px-4 py-3 md:px-6 md:py-4 rounded-2xl min-w-[70px] md:min-w-[90px] border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                    <div className="text-2xl md:text-4xl font-black text-emerald-400 font-mono tracking-tighter">
                      {String(timeLeft.seconds).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1">Segundos</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link id="hero-cta-main" href="/login?mode=signup" className="group flex items-center justify-center gap-4 px-10 py-5 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all">
                CRIAR MEU GRUPO
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link id="hero-cta-secondary" href="/dashboard/matches" className="flex items-center justify-center gap-4 px-10 py-5 bg-slate-900 border border-slate-800 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all">
                TABELA COMPLETA
              </Link>
            </div>
          </motion.div>

          {/* Floating Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-32">
            <CountryPillar id="pillar-ca" name="CANADÁ" city="TORONTO" code="CAN" delay={0.1} />
            <CountryPillar id="pillar-mx" name="MÉXICO" city="CIDADE DO MÉXICO" code="MEX" delay={0.2} active />
            <CountryPillar id="pillar-us" name="ESTADOS UNIDOS" city="USA" code="USA" delay={0.3} />
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section className="px-6 py-32 bg-[#0A101F] relative">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4 italic">INOVAÇÃO <span className="text-emerald-500">NO CAMPO</span></h2>
            <div className="h-1 w-20 bg-emerald-500"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-4 h-auto md:h-[600px]">
             {/* Large Feature */}
             <div id="feature-algo" className="md:col-span-2 md:row-span-2 glass rounded-[40px] p-12 flex flex-col justify-end group overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Globe size={300} />
                </div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-8">
                     <TrendingUp size={32} className="text-emerald-400" />
                  </div>
                  <h3 className="text-4xl font-black uppercase tracking-tighter mb-4">ALGORITMO DE <br />PONTUAÇÃO REAL</h3>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs leading-loose">
                    Diga adeus ao óbvio. Nosso sistema calcula raridade de placar e bônus por zebras em tempo real.
                  </p>
                </div>
             </div>

             {/* Small Features */}
             <div id="feature-security" className="md:col-span-2 glass rounded-[32px] p-8 flex items-center gap-6 group">
                <div className="w-12 h-12 shrink-0 bg-emerald-500 rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                  <ShieldCheck size={24} className="text-black" />
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-widest text-sm mb-1">ANTI-FALCATRUAS</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Criptografia e transparência total em cada palpite enviado.</p>
                </div>
             </div>

             <div id="feature-groups" className="md:col-span-1 glass rounded-[32px] p-8 flex flex-col justify-center items-center text-center gap-4 border-emerald-500/10">
                <Users size={32} className="text-cyan-400" />
                <h3 className="font-black uppercase text-[10px] tracking-widest">GRUPOS<br />ILIMITADOS</h3>
             </div>

             <div id="feature-powerups" className="md:col-span-1 bg-emerald-500 rounded-[32px] p-8 flex flex-col justify-center items-center text-center gap-4 shadow-2xl shadow-emerald-500/20 group">
                <Zap size={32} className="text-black group-hover:scale-125 transition-transform" />
                <h3 className="font-black uppercase text-[10px] tracking-widest text-black">POWER<br />UPS</h3>
             </div>
          </div>
        </div>
      </section>

      {/* Social / Call to Action */}
      <section className="px-6 py-40">
        <div className="max-w-4xl mx-auto glass p-12 md:p-24 rounded-[60px] text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
          <Trophy size={64} className="mx-auto mb-10 text-amber-400 animate-bounce" />
          <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter mb-8 leading-[0.9]">ESTÁ PRONTO PARA A <span className="text-emerald-500">GLÓRIA?</span></h2>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] mb-12 text-xs md:text-sm">Junte-se a milhares de torcedores na maior plataforma de bolão do planeta.</p>
          <Link id="final-cta" href="/login?mode=signup" className="inline-flex px-12 py-6 bg-white text-black font-black uppercase tracking-[0.3em] rounded-full hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/5">
            REIVINDICAR MEU REINO
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 border-t border-white/5 text-center">
        <p className="text-[10px] font-black uppercase tracking-[1em] text-slate-700">BOLÃO UNITED 2026 — TODOS OS DIREITOS RESERVADOS</p>
      </footer>
    </div>
  );
}

function CountryPillar({ id, name, city, code, delay, active = false }: { id: string, name: string, city: string, code: string, delay: number, active?: boolean }) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`p-10 rounded-[40px] border transition-all duration-500 flex flex-col items-center gap-8 group hover:-translate-y-4 ${
        active 
          ? 'bg-emerald-500/5 border-emerald-500/30' 
          : 'bg-slate-900/40 border-slate-800 hover:border-slate-600'
      }`}
    >
      <div className="w-24 h-16 rounded-xl overflow-hidden shadow-2xl border border-white/10 group-hover:scale-110 transition-transform">
        <Flag code={code} className="w-full h-full object-cover" />
      </div>
      <div className="text-center">
        <h4 className={`font-black text-2xl uppercase tracking-tighter mb-1 transition-colors ${active ? 'text-emerald-400' : 'text-white'}`}>{name}</h4>
        <div className="flex items-center justify-center gap-2 text-slate-600">
           <MapPin size={10} />
           <span className="text-[8px] font-black uppercase tracking-widest">{city}</span>
        </div>
      </div>
    </motion.div>
  );
}
