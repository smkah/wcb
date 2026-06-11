import { supabase } from './supabase';
import { WORLD_CUP_DATA } from './data';

export const adminApi = {
  // Profiles/Users
  async createUser(userData: any) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const { createClient } = await import('@supabase/supabase-js');
    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });

    const { data, error } = await tempClient.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          username: userData.username.trim().toLowerCase(),
          full_name: userData.full_name.trim(),
        }
      }
    });

    if (error) throw error;
    return data.user;
  },

  async getUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async deleteUser(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (error) throw error;
  },

  async updateUser(userId: string, updates: any) {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    
    if (error) throw error;
  },

  async addUserToGroup(profileId: string, groupId: string) {
    const { error } = await supabase
      .from('group_members')
      .insert({ profile_id: profileId, group_id: groupId });
    
    if (error) throw error;
  },

  // Helpers
  async ensureProfile(user: any) {
    if (!user) return;
    try {
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      
      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      if (!profile) {
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email?.split('@')[0].toLowerCase(),
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          points: 0
        });

        // Ignore duplicate key errors (might have been created by trigger)
        if (insertError && insertError.code !== '23505') throw insertError;
      }
      return user.id;
    } catch (error) {
      console.error('Error in ensureProfile:', error);
      return user.id; // Still return ID to allow session to continue
    }
  },

  // Groups (Bolões)
  async getGroups() {
    const { data, error } = await supabase
      .from('groups')
      .select('*, profiles!groups_created_by_fkey(email, full_name)')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Supabase getGroups error:", error);
      throw error;
    }
    return data;
  },

  async getGroupMembers(groupId: string) {
    const { data, error } = await supabase
      .from('group_members')
      .select('*, profiles(id, email, full_name)')
      .eq('group_id', groupId);
    
    if (error) throw error;
    return data;
  },

  async removeUserFromGroup(profileId: string, groupId: string) {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('profile_id', profileId)
      .eq('group_id', groupId);
    
    if (error) throw error;
  },

  async createGroup(groupData: any) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    await this.ensureProfile(user);

    const { data, error } = await supabase
      .from('groups')
      .insert({
        ...groupData,
        created_by: user.id,
        code: Math.random().toString(36).substring(2, 8).toUpperCase()
      })
      .select()
      .single();
    
    if (error) throw error;

    // Adicionar criador como membro automaticamente
    if (data) {
      await this.addUserToGroup(user.id, data.id).catch(console.error);
    }

    return data;
  },

  async updateGroup(groupId: string, updates: any) {
    const { error } = await supabase
      .from('groups')
      .update(updates)
      .eq('id', groupId);
    
    if (error) throw error;
  },

  async deleteGroup(groupId: string) {
    // 1. Explicitly remove members first to avoid FK constraint issues if RLS is weirdly handled in cascade
    try {
      const { error: memberError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId);
      
      if (memberError) {
        console.warn("Could not delete group members proactively:", memberError.message);
      }
    } catch (e) {
      console.warn("Proactive member deletion failed but continuing:", e);
    }

    // 2. Delete the group itself
    const { error: groupError } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);
    
    if (groupError) {
      console.error("Error deleting group from Supabase:", groupError);
      throw groupError;
    }
  },

  // Matches
  async getMatches() {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async createMatch(matchData: any) {
    const { data, error } = await supabase
      .from('matches')
      .insert(matchData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateMatch(matchId: string, updates: any) {
    const { error } = await supabase
      .from('matches')
      .update(updates)
      .eq('id', matchId);
    
    if (error) throw error;
  },

  async deleteMatch(matchId: string) {
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', matchId);
    
    if (error) throw error;
  },

  async syncInitialMatches() {
    // Check if matches already exist
    const { count } = await supabase.from('matches').select('*', { count: 'exact', head: true });
    
    if (count === 0) {
      const { error } = await supabase.from('matches').insert(
        WORLD_CUP_DATA.matches.map(m => ({
          id: m.id,
          team1: m.team1,
          team2: m.team2,
          date: m.date,
          time: m.time,
          group: m.group || null,
          round: m.round,
          ground: m.ground
        }))
      );
      if (error) throw error;
      return true;
    }
    return false;
  },

  async simulateResults() {
    const { data: matches, error } = await supabase
      .from('matches')
      .select('id, score1, score2');
    
    if (error) throw error;

    for (const match of matches) {
      if (match.score1 === null || match.score2 === null) {
        await supabase
          .from('matches')
          .update({
            score1: Math.floor(Math.random() * 4),
            score2: Math.floor(Math.random() * 3)
          })
          .eq('id', match.id);
      }
    }
  },

  async exportAllGuesses() {
    const { data: guesses, error: guessesError } = await supabase
      .from('guesses')
      .select('*');
    
    if (guessesError) throw guessesError;

    const { data: groupPredictions, error: groupPredsError } = await supabase
      .from('group_predictions')
      .select('*');
    
    if (groupPredsError) throw groupPredsError;

    return {
      guesses: guesses || [],
      group_predictions: groupPredictions || []
    };
  },

  async importGuesses(guesses: any[], groupPredictions: any[]) {
    // 1. Import regular match guesses
    if (guesses && guesses.length > 0) {
      const cleanGuesses = guesses.map(g => ({
        profile_id: g.profile_id,
        match_id: g.match_id,
        score1: g.score1,
        score2: g.score2,
        custom_guesses: g.custom_guesses || {},
        yellow_cards_winner: g.yellow_cards_winner,
        has_red_card: g.has_red_card
      }));

      const { error } = await supabase
        .from('guesses')
        .upsert(cleanGuesses, { onConflict: 'profile_id,match_id' });
      
      if (error) throw error;
    }

    // 2. Import group classification predictions
    if (groupPredictions && groupPredictions.length > 0) {
      const cleanGroupPreds = groupPredictions.map(gp => ({
        profile_id: gp.profile_id,
        group_letter: gp.group_letter,
        first_place: gp.first_place,
        second_place: gp.second_place,
        third_place: gp.third_place,
        third_place_qualified: gp.third_place_qualified || false
      }));

      const { error } = await supabase
        .from('group_predictions')
        .upsert(cleanGroupPreds, { onConflict: 'profile_id,group_letter' });
      
      if (error) throw error;
    }

    // 3. Recalculate points after import
    const { error: recalcError } = await supabase.rpc('recalculate_all_user_points');
    if (recalcError) {
      console.warn("Could not auto-recalculate points on import:", recalcError.message);
    }
  }
};
