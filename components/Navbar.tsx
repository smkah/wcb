'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, Calendar, Users, TrendingUp, LogOut, Menu, X, ShieldAlert, User, HelpCircle, Gamepad2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    };
    checkUser();
  }, []);

  const isAdmin = user?.email === 'samukahweb@gmail.com';

  const navItems = [
    { name: 'Dashboard', icon: TrendingUp, href: '/dashboard' },
    { name: 'Partidas', icon: Calendar, href: '/dashboard/matches' },
    { name: 'Ranking', icon: Trophy, href: '/dashboard/ranking' },
    { name: 'Bolões', icon: Users, href: '/dashboard/groups' },
    { name: 'Regras', icon: HelpCircle, href: '/dashboard/rules' },
    { name: 'Game', icon: Gamepad2, href: '/dashboard/game' },
    { name: 'Perfil', icon: User, href: '/dashboard/profile' },
  ];

  if (isAdmin) {
    navItems.push({ name: 'Admin', icon: ShieldAlert, href: '/dashboard/admin' });
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Até logo!');
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    } catch (err) {
      toast.error('Erro ao sair');
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-[#1E293B]/80 backdrop-blur-md border-b border-slate-700/50 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-display font-black flex items-center gap-3 group">
          <div className="w-10 h-10 bg-gradient-to-tr from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-active:scale-95 transition-transform">
            <Trophy size={22} className="text-white" />
          </div>
          <span className="tracking-tight uppercase">BOLÃO <span className="text-emerald-400 font-extrabold italic">2026</span></span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-700/50">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                  isActive 
                    ? 'bg-emerald-500 text-slate-900' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon size={18} />
                {item.name}
              </Link>
            );
          })}
          <div className="w-px h-6 bg-slate-700 mx-2" />
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
            title="Sair"
          >
            <LogOut size={20} />
          </button>
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden p-2 rounded-xl hover:bg-slate-800 text-slate-300"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden mt-4 flex flex-col gap-2 overflow-hidden"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-4 rounded-xl text-lg font-bold transition-all ${
                    isActive 
                      ? 'bg-emerald-500 text-slate-900' 
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon size={22} />
                  {item.name}
                </Link>
              );
            })}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-4 rounded-xl text-lg font-bold text-red-400 bg-red-400/10"
            >
              <LogOut size={22} />
              Sair da Conta
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
