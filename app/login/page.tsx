'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { Trophy, Mail, Lock, Loader2, ArrowLeft, AlertTriangle, User } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { isSupabaseConfigured } from '@/lib/supabase';

import { Suspense } from 'react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail) {
      Promise.resolve().then(() => {
        setEmail(savedEmail);
        setRememberMe(true);
      });
    }
  }, []);

  useEffect(() => {
    const m = searchParams.get('mode');
    Promise.resolve().then(() => {
      if (m === 'signup') {
        setMode('signup');
      } else {
        setMode('login');
      }
    });
  }, [searchParams]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError('Credenciais do Supabase não encontradas. Configure as variáveis de ambiente.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        if (!username.trim()) {
          throw new Error('O nome de usuário é obrigatório.');
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              username: username.trim().toLowerCase(),
              full_name: username.trim(),
            }
          },
        });
        if (error) throw error;
        toast.success('Conta criada! Confirme seu e-mail para continuar.');
      } else {
        let finalEmail = email.trim();
        if (!finalEmail.includes('@')) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', finalEmail.toLowerCase())
            .maybeSingle();

          if (profileError || !profileData) {
            throw new Error('Nome de usuário não encontrado.');
          }
          finalEmail = profileData.email;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: finalEmail,
          password,
        });
        if (error) throw error;
        
        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        } else {
          localStorage.removeItem('remembered_email');
        }

        toast.success('Bem-vindo de volta!');
        router.push('/dashboard');
      }
    } catch (err: any) {
      let msg = err.message || 'Ocorreu um erro na autenticação.';
      if (msg === 'Invalid login credentials') msg = 'E-mail ou senha incorretos.';
      if (msg.includes('Email not confirmed')) msg = 'Por favor, confirme seu e-mail para entrar.';
      
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0F172A]">
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0F172A] relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 pointer-events-none" />
      
      <Link 
        href="/" 
        className="absolute top-8 left-8 flex items-center gap-2 font-bold text-slate-400 hover:text-white transition-opacity"
      >
        <ArrowLeft size={20} />
        Voltar para a Home
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-tr from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-6">
            <Trophy size={32} className="text-white" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tighter uppercase mb-2">
            {mode === 'login' ? 'BEM-VINDO' : 'CRIAR CONTA'}
          </h1>
          <p className="text-slate-400 text-center font-medium">
            {mode === 'login' 
              ? 'Entre para acompanhar seus palpites.' 
              : 'Junte-se ao maior bolão de 2026.'}
          </p>
        </div>

        <div className="glass p-10 rounded-[32px] flex flex-col gap-6">
          <form onSubmit={handleAuth} className="flex flex-col gap-6">
            {error && (
              <div className="p-4 bg-red-500/10 text-red-400 rounded-xl text-sm font-bold border border-red-500/20">
                {error}
              </div>
            )}

            {mode === 'signup' && (
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nome de Usuário</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ''))}
                    className="w-full pl-12 pr-4 py-4 bg-slate-900/50 rounded-2xl border border-slate-700/50 text-white focus:ring-2 focus:ring-emerald-500/50 transition-all outline-none font-medium placeholder:text-slate-700"
                    placeholder="usuario"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {mode === 'login' ? 'E-mail ou Usuário' : 'Seu E-mail'}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                  type={mode === 'login' ? 'text' : 'email'}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-900/50 rounded-2xl border border-slate-700/50 text-white focus:ring-2 focus:ring-emerald-500/50 transition-all outline-none font-medium placeholder:text-slate-700"
                  placeholder={mode === 'login' ? 'seu@email.com ou usuario' : 'seu@email.com'}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sua Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-900/50 rounded-2xl border border-slate-700/50 text-white focus:ring-2 focus:ring-emerald-500/50 transition-all outline-none font-medium placeholder:text-slate-700"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="remember" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/50"
                />
                <label htmlFor="remember" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-slate-400 transition-colors">
                  Lembrar e-mail
                </label>
              </div>
              {mode === 'login' && (
                <button type="button" className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest hover:text-emerald-400 transition-colors">
                  Esqueci a senha
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-emerald-500 text-slate-900 font-black text-lg uppercase tracking-[0.1em] rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3 disabled:opacity-50 hover:bg-emerald-400 active:scale-[0.98] transition-all"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                mode === 'login' ? 'ENTRAR AGORA' : 'CRIAR MINHA CONTA'
              )}
            </button>
          </form>
        </div>

        <div className="mt-10 text-center">
          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-slate-400 font-bold hover:text-white transition-colors"
          >
            {mode === 'login' ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre agora'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center">Carregando...</div>}>
      <LoginContent />
    </Suspense>
  );
}
