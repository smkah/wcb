import { supabase } from './supabase';
import { WORLD_CUP_DATA } from './data';
import { normalizeTeamName } from './utils';

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

  async sanitizeGuessesYellowCards() {
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id, team1, team2');
    if (matchesError) throw matchesError;

    const { data: guesses, error: guessesError } = await supabase
      .from('guesses')
      .select('id, match_id, yellow_cards_winner')
      .not('yellow_cards_winner', 'is', null)
      .neq('yellow_cards_winner', 'Empate');
    if (guessesError) throw guessesError;

    const matchesMap = new Map(matches.map(m => [m.id, m]));
    const updates = [];

    for (const g of guesses) {
      const match = matchesMap.get(g.match_id);
      if (!match) continue;

      const normWinner = normalizeTeamName(g.yellow_cards_winner);
      const normTeam1 = normalizeTeamName(match.team1);
      const normTeam2 = normalizeTeamName(match.team2);

      let correctName = null;
      if (normWinner === normTeam1 && g.yellow_cards_winner !== match.team1) {
        correctName = match.team1;
      } else if (normWinner === normTeam2 && g.yellow_cards_winner !== match.team2) {
        correctName = match.team2;
      }

      if (correctName) {
        updates.push({
          id: g.id,
          yellow_cards_winner: correctName
        });
      }
    }

    if (updates.length > 0) {
      console.log(`Sanitizing ${updates.length} guesses yellow card values...`);
      for (const u of updates) {
        await supabase
          .from('guesses')
          .update({ yellow_cards_winner: u.yellow_cards_winner })
          .eq('id', u.id);
      }
    }
  },

  async syncInitialMatches() {
    const { data: dbMatches, error: fetchError } = await supabase.from('matches').select('id, date, time, ground');
    if (fetchError) throw fetchError;

    const dbMatchesMap = new Map(dbMatches?.map(m => [m.id, m]));
    const updates = [];
    const inserts = [];

    for (const m of WORLD_CUP_DATA.matches) {
      const dbMatch = dbMatchesMap.get(m.id);
      if (!dbMatch) {
        inserts.push({
          id: m.id,
          team1: m.team1,
          team2: m.team2,
          date: m.date,
          time: m.time,
          group: m.group || null,
          round: m.round,
          ground: m.ground
        });
      } else if (dbMatch.date !== m.date || dbMatch.time !== m.time || dbMatch.ground !== m.ground) {
        updates.push({
          id: m.id,
          date: m.date,
          time: m.time,
          ground: m.ground
        });
      }
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from('matches').insert(inserts);
      if (error) throw error;
    }

    for (const update of updates) {
      const { error } = await supabase
        .from('matches')
        .update({ date: update.date, time: update.time, ground: update.ground })
        .eq('id', update.id);
      if (error) throw error;
    }

    try {
      await adminApi.sanitizeGuessesYellowCards();
    } catch (err) {
      console.error("Failed to sanitize guesses yellow cards during sync:", err);
    }

    return true;
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
  },

  async autocompleteGroupPredictions() {
    const { data: matches, error: matchesErr } = await supabase
      .from('matches')
      .select('id, team1, team2, score1, score2, group')
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    if (matchesErr) throw matchesErr;

    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id');
    if (profilesErr) throw profilesErr;

    const { data: guesses, error: guessesErr } = await supabase
      .from('guesses')
      .select('profile_id, match_id, score1, score2');
    if (guessesErr) throw guessesErr;

    const groupMatches = matches.filter(m => m.group);
    const guessesMap = new Map<string, any[]>();
    guesses.forEach(g => {
      if (!guessesMap.has(g.profile_id)) {
        guessesMap.set(g.profile_id, []);
      }
      guessesMap.get(g.profile_id)!.push(g);
    });

    const allGroupPredictions: any[] = [];

    for (const p of profiles) {
      const userGuesses = guessesMap.get(p.id) || [];
      const userGuessesMap = new Map(userGuesses.map(g => [g.match_id, g]));
      const groupsList = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
      const userThirdPlaces: any[] = [];

      for (const groupLetter of groupsList) {
        const matchesInGroup = groupMatches.filter(m => m.group === groupLetter);
        const teamsStats: Record<string, { name: string, points: number, gd: number, gs: number }> = {};

        const initTeam = (name: string) => {
          if (!teamsStats[name]) {
            teamsStats[name] = { name, points: 0, gd: 0, gs: 0 };
          }
        };

        matchesInGroup.forEach(m => {
          initTeam(m.team1);
          initTeam(m.team2);

          let score1 = m.score1;
          let score2 = m.score2;

          if (score1 === null || score2 === null) {
            const userGuess = userGuessesMap.get(m.id);
            if (userGuess && userGuess.score1 !== null && userGuess.score2 !== null) {
              score1 = userGuess.score1;
              score2 = userGuess.score2;
            }
          }

          if (score1 !== null && score2 !== null) {
            teamsStats[m.team1].gs += score1;
            teamsStats[m.team2].gs += score2;
            teamsStats[m.team1].gd += (score1 - score2);
            teamsStats[m.team2].gd += (score2 - score1);

            if (score1 > score2) {
              teamsStats[m.team1].points += 3;
            } else if (score2 > score1) {
              teamsStats[m.team2].points += 3;
            } else {
              teamsStats[m.team1].points += 1;
              teamsStats[m.team2].points += 1;
            }
          }
        });

        const sortedTeams = Object.values(teamsStats).sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.gd !== a.gd) return b.gd - a.gd;
          if (b.gs !== a.gs) return b.gs - a.gs;
          return a.name.localeCompare(b.name);
        });

        const getTeamAt = (idx: number) => sortedTeams[idx]?.name || '';

        const firstPlace = getTeamAt(0);
        const secondPlace = getTeamAt(1);
        const thirdPlace = getTeamAt(2);

        allGroupPredictions.push({
          profile_id: p.id,
          group_letter: groupLetter,
          first_place: firstPlace,
          second_place: secondPlace,
          third_place: thirdPlace,
          third_place_qualified: false
        });

        if (thirdPlace) {
          userThirdPlaces.push({
            profile_id: p.id,
            group_letter: groupLetter,
            team_name: thirdPlace,
            points: teamsStats[thirdPlace]?.points || 0,
            gd: teamsStats[thirdPlace]?.gd || 0,
            gs: teamsStats[thirdPlace]?.gs || 0
          });
        }
      }

      userThirdPlaces.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gs !== a.gs) return b.gs - a.gs;
        return a.team_name.localeCompare(b.team_name);
      });

      const qualifiedThirds = new Set(userThirdPlaces.slice(0, 8).map(t => `${t.group_letter}_${t.team_name}`));

      allGroupPredictions.forEach(gp => {
        if (gp.profile_id === p.id && gp.third_place && qualifiedThirds.has(`${gp.group_letter}_${gp.third_place}`)) {
          gp.third_place_qualified = true;
        }
      });
    }

    if (allGroupPredictions.length > 0) {
      const { error: upsertErr } = await supabase
        .from('group_predictions')
        .upsert(allGroupPredictions, { onConflict: 'profile_id,group_letter' });
      if (upsertErr) throw upsertErr;

      const { error: recalcError } = await supabase.rpc('recalculate_all_user_points');
      if (recalcError) {
        console.error("Autocomplete group predictions points recalculation failed:", recalcError.message);
      }
    }
    return true;
  },

  async populateRoundOf32Matches() {
    // 1. Fetch group results
    const { data: groupResults, error: grError } = await supabase
      .from('group_results')
      .select('*');
    if (grError) throw grError;

    // 2. Fetch matches for 16-avos de final
    const { data: dbMatches, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .eq('round', '16-avos de final');
    if (matchesError) throw matchesError;

    // 3. Define original placeholders
    const originalMatches = [
      { id: 'm73', team1: '2A', team2: '2B' },
      { id: 'm74', team1: '1E', team2: '3A/B/C/D/F' },
      { id: 'm75', team1: '1F', team2: '2C' },
      { id: 'm76', team1: '1C', team2: '2F' },
      { id: 'm77', team1: '1I', team2: '3C/D/F/G/H' },
      { id: 'm78', team1: '2E', team2: '2I' },
      { id: 'm79', team1: '1A', team2: '3C/E/F/H/I' },
      { id: 'm80', team1: '1L', team2: '3E/H/I/J/K' },
      { id: 'm81', team1: '1D', team2: '3B/E/F/I/J' },
      { id: 'm82', team1: '1G', team2: '3A/E/H/I/J' },
      { id: 'm83', team1: '2K', team2: '2L' },
      { id: 'm84', team1: '1H', team2: '2J' },
      { id: 'm85', team1: '1B', team2: '3E/F/G/I/J' },
      { id: 'm86', team1: '1J', team2: '2H' },
      { id: 'm87', team1: '1K', team2: '3D/E/I/J/L' },
      { id: 'm88', team1: '2D', team2: '2G' }
    ];

    // Create lookup maps for group results
    const firstPlaceMap = new Map<string, string>();
    const secondPlaceMap = new Map<string, string>();
    const thirdPlaceMap = new Map<string, string>();
    const qualifiedThirds: string[] = [];

    groupResults.forEach(gr => {
      const g = gr.group_letter;
      if (gr.first_place) firstPlaceMap.set(g, gr.first_place);
      if (gr.second_place) secondPlaceMap.set(g, gr.second_place);
      if (gr.third_place) {
        thirdPlaceMap.set(g, gr.third_place);
        if (gr.third_place_qualified) {
          qualifiedThirds.push(g);
        }
      }
    });

    // Solve third-place bipartite matching if there are exactly 8 qualified third place groups
    let thirdPlaceAssignment: Record<string, string> = {};
    if (qualifiedThirds.length === 8) {
      const matchesWithThirds = [
        { id: 'm74', allowed: ['A', 'B', 'C', 'D', 'F'] },
        { id: 'm77', allowed: ['C', 'D', 'F', 'G', 'H'] },
        { id: 'm79', allowed: ['C', 'E', 'F', 'H', 'I'] },
        { id: 'm80', allowed: ['E', 'H', 'I', 'J', 'K'] },
        { id: 'm81', allowed: ['B', 'E', 'F', 'I', 'J'] },
        { id: 'm82', allowed: ['A', 'E', 'H', 'I', 'J'] },
        { id: 'm85', allowed: ['E', 'F', 'G', 'I', 'J'] },
        { id: 'm87', allowed: ['D', 'E', 'I', 'J', 'L'] }
      ];

      const assignment: Record<string, string> = {};
      const usedMatches = new Set<string>();

      const backtrack = (idx: number): boolean => {
        if (idx === qualifiedThirds.length) return true;
        const group = qualifiedThirds[idx];
        for (const m of matchesWithThirds) {
          if (!usedMatches.has(m.id) && m.allowed.includes(group)) {
            assignment[m.id] = group;
            usedMatches.add(m.id);
            if (backtrack(idx + 1)) return true;
            usedMatches.delete(m.id);
            delete assignment[m.id];
          }
        }
        return false;
      };

      qualifiedThirds.sort();
      if (backtrack(0)) {
        thirdPlaceAssignment = assignment;
      }
    }

    // Now, build the updates
    const dbMatchesMap = new Map(dbMatches.map(m => [m.id, m]));
    const updates: Array<{ id: string, team1: string, team2: string }> = [];

    originalMatches.forEach(orig => {
      let team1 = orig.team1;
      let team2 = orig.team2;

      // Resolve team1
      if (team1.startsWith('1')) {
        const group = team1.substring(1);
        team1 = firstPlaceMap.get(group) || orig.team1;
      } else if (team1.startsWith('2')) {
        const group = team1.substring(1);
        team1 = secondPlaceMap.get(group) || orig.team1;
      }

      // Resolve team2
      if (team2.startsWith('2')) {
        const group = team2.substring(1);
        team2 = secondPlaceMap.get(group) || orig.team2;
      } else if (team2.startsWith('3')) {
        const assignedGroup = thirdPlaceAssignment[orig.id];
        if (assignedGroup) {
          team2 = thirdPlaceMap.get(assignedGroup) || orig.team2;
        } else {
          team2 = orig.team2;
        }
      }

      const dbMatch = dbMatchesMap.get(orig.id);
      if (dbMatch && (dbMatch.team1 !== team1 || dbMatch.team2 !== team2)) {
        updates.push({ id: orig.id, team1, team2 });
      }
    });

    // Execute the updates
    if (updates.length > 0) {
      console.log(`Updating ${updates.length} Round of 32 matches...`, updates);
      for (const u of updates) {
        const { error: updErr } = await supabase
          .from('matches')
          .update({ team1: u.team1, team2: u.team2 })
          .eq('id', u.id);
        if (updErr) throw updErr;
      }
    }
  }
};
