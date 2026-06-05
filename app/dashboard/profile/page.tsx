'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { motion } from 'motion/react';
import { User, Mail, Save, Loader2, Camera } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import EvolutionChart from '@/components/EvolutionChart';

import { BADGES_DEFINITION, calculateUserBadges } from '@/lib/badges';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    avatar_url: '',
  });
  const [userGuesses, setUserGuesses] = useState<any[]>([]);
  const [userGroupPredictions, setUserGroupPredictions] = useState<any[]>([]);
  const [groupResults, setGroupResults] = useState<any[]>([]);
  const [rankingPosition, setRankingPosition] = useState<number | undefined>(undefined);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!isSupabaseConfigured) return;
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
          router.push('/login');
          return;
        }
        setUser(currentUser);

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (error) throw error;
        if (data) {
          setProfile({
            full_name: data.full_name || '',
            email: data.email || '',
            avatar_url: data.avatar_url || '',
          });
          setRankingPosition(data.ranking_position || undefined);
        }

        // Fetch user guesses
        const { data: guessesData } = await supabase
          .from('guesses')
          .select('points_earned')
          .eq('profile_id', currentUser.id);
        if (guessesData) setUserGuesses(guessesData);

        // Fetch user group predictions
        const { data: groupPreds } = await supabase
          .from('group_predictions')
          .select('*')
          .eq('profile_id', currentUser.id);
        if (groupPreds) setUserGroupPredictions(groupPreds);

        // Fetch group results
        const { data: resultsData } = await supabase
          .from('group_results')
          .select('*');
        if (resultsData) setGroupResults(resultsData);

      } catch (err) {
        console.error("Error fetching profile:", err);
        toast.error("Erro ao carregar perfil");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${user.id}-${Math.random()}.${fileExt}`;

      // Upload file to Supabase Storage Bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Save to profiles database table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success("Foto de perfil atualizada!");
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast.error("Erro ao enviar imagem: " + (err.message || "Verifique se o bucket 'avatars' está criado e público no Supabase."));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success("Perfil atualizado com sucesso!");
    } catch (err) {
      console.error("Error saving profile:", err);
      toast.error("Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-emerald-400 bg-[#0F172A]">Carregando...</div>;

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100">
      <Navbar />

      <main className="max-w-4xl mx-auto p-6 md:p-12">
        <header className="mb-12">
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Meu Perfil</h1>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Gerencie suas informações pessoais</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Avatar Section */}
          <div className="md:col-span-1">
            <div className="glass p-8 rounded-[32px] text-center">
              <div className="relative inline-block mb-6">
                <div className="w-32 h-32 bg-gradient-to-tr from-emerald-400 to-cyan-500 rounded-3xl flex items-center justify-center text-4xl font-black text-slate-900 shadow-xl shadow-emerald-500/20 overflow-hidden">
                  {profile.avatar_url ? (
                    <img 
                      src={profile.avatar_url} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    profile.full_name?.[0]?.toUpperCase() || profile.email?.[0]?.toUpperCase() || '?'
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 p-3 bg-slate-900 border border-slate-700 rounded-xl text-emerald-400 hover:text-white transition-colors shadow-lg cursor-pointer">
                  {uploading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Camera size={18} />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight truncate">{profile.full_name || 'Usuário'}</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Membro desde 2026</p>
            </div>
          </div>

          {/* Form Section */}
          <div className="md:col-span-2">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass p-10 rounded-[40px]"
            >
              <form onSubmit={handleSave} className="space-y-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-2">Nome Completo</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input
                        type="text"
                        value={profile.full_name}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        placeholder="Seu nome"
                        className="w-full pl-12 pr-6 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 opacity-60">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-2">E-mail (Não alterável)</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input
                        type="email"
                        value={profile.email}
                        disabled
                        className="w-full pl-12 pr-6 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl text-sm font-bold outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-4 bg-emerald-500 text-slate-900 font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 hover:bg-emerald-400 active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        <Save size={20} /> SALVAR ALTERAÇÕES
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>

            <div className="mt-8 p-6 bg-slate-900/30 rounded-3xl border border-slate-800/50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-loose">
                Suas informações de perfil são usadas para identificá-lo nos bolões que você participa. O e-mail é utilizado apenas para login e comunicações importantes.
              </p>
            </div>
          </div>
        </div>

        {user && (
          <div className="mt-12 space-y-12 pb-20">
            <EvolutionChart profileId={user.id} />
            
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Minhas Conquistas</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Medalhas virtuais desbloqueadas de acordo com seu desempenho</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                {BADGES_DEFINITION.map(badge => {
                  const earnedList = calculateUserBadges(userGuesses, rankingPosition, userGroupPredictions, groupResults);
                  const isEarned = earnedList.includes(badge.id);
                  return (
                    <div 
                      key={badge.id}
                      className={`glass p-5 rounded-2xl flex flex-col items-center text-center justify-between border transition-all duration-300 relative overflow-hidden ${
                        isEarned 
                          ? `${badge.color} shadow-lg ${badge.glowColor} scale-100` 
                          : 'border-slate-800/80 text-slate-600 opacity-40 grayscale scale-95'
                      }`}
                      title={badge.description}
                    >
                      <div className="text-3xl mb-3">{badge.icon}</div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-100">{badge.name}</p>
                        <p className="text-[8px] font-bold text-slate-500 mt-1 line-clamp-2 leading-relaxed">{badge.description}</p>
                      </div>
                      {!isEarned && (
                        <div className="absolute top-2 right-2 text-[9px] font-black tracking-widest text-slate-600">🔒</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
