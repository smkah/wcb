export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji ou nome do ícone
  color: string; // Tailwind color class (ex: text-amber-400)
  glowColor: string; // Shadow glow color class (ex: shadow-amber-500/20)
}

export const BADGES_DEFINITION: Badge[] = [
  {
    id: 'lider',
    name: 'No Topo',
    description: 'Ficar entre os 3 primeiros colocados do ranking global.',
    icon: '👑',
    color: 'text-amber-400 border-amber-400/30 bg-amber-400/5',
    glowColor: 'shadow-amber-400/20 border-amber-500/30'
  },
  {
    id: 'sniper',
    name: 'Sniper',
    description: 'Acertar 3 ou mais placares exatos (5 pontos de uma vez).',
    icon: '🎯',
    color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5',
    glowColor: 'shadow-emerald-400/20 border-emerald-500/30'
  },
  {
    id: 'pe_quente',
    name: 'Pé Quente',
    description: 'Acertar 5 ou mais resultados de jogos.',
    icon: '🔥',
    color: 'text-orange-400 border-orange-400/30 bg-orange-400/5',
    glowColor: 'shadow-orange-400/20 border-orange-500/30'
  },
  {
    id: 'pe_coelho',
    name: 'Pé de Coelho',
    description: 'Acumular 15 ou mais pontos em palpites de partidas.',
    icon: '🐰',
    color: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/5',
    glowColor: 'shadow-cyan-400/20 border-cyan-500/30'
  },
  {
    id: 'veterano',
    name: 'Veterano',
    description: 'Ter palpitado em 10 ou mais jogos.',
    icon: '🛡️',
    color: 'text-purple-400 border-purple-400/30 bg-purple-400/5',
    glowColor: 'shadow-purple-400/20 border-purple-500/30'
  },
  {
    id: 'guru',
    name: 'Guru dos Grupos',
    description: 'Acertar pelo menos 1 resultado final de classificação de grupos.',
    icon: '🔮',
    color: 'text-pink-400 border-pink-400/30 bg-pink-400/5',
    glowColor: 'shadow-pink-400/20 border-pink-500/30'
  }
];

export function calculateUserBadges(
  guesses: any[],
  rankingPosition?: number,
  groupPredictions?: any[],
  groupResults?: any[]
): string[] {
  const earned: string[] = [];

  // 1. Líder: Posição entre os 3 primeiros
  if (rankingPosition && rankingPosition <= 3 && rankingPosition > 0) {
    earned.push('lider');
  }

  // 2. Sniper: 3+ placares exatos (5 pontos earned. Nota: na regra do bolão, exact_score dá 5 pontos)
  const exactScoresCount = guesses.filter(g => g.points_earned === 5).length;
  if (exactScoresCount >= 3) {
    earned.push('sniper');
  }

  // 3. Pé Quente: 5+ resultados corretos (pontos_earned >= 2)
  const correctOutcomesCount = guesses.filter(g => g.points_earned >= 2).length;
  if (correctOutcomesCount >= 5) {
    earned.push('pe_quente');
  }

  // 4. Pé de Coelho: 15+ pontos totais em palpites
  const totalMatchPoints = guesses.reduce((acc, g) => acc + (g.points_earned || 0), 0);
  if (totalMatchPoints >= 15) {
    earned.push('pe_coelho');
  }

  // 5. Veterano: 10+ palpites feitos
  if (guesses.length >= 10) {
    earned.push('veterano');
  }

  // 6. Guru dos Grupos: Acertou 1+ classificação de grupos
  if (groupPredictions && groupPredictions.length > 0 && groupResults && groupResults.length > 0) {
    const resultsMap = new Map<string, any>();
    groupResults.forEach(r => resultsMap.set(r.group_letter, r));

    let hasCorrectGroupResult = false;
    for (const pred of groupPredictions) {
      const actual = resultsMap.get(pred.group_letter);
      if (actual && actual.first_place) {
        // Se acertou pelo menos o 1º ou 2º colocado ou o 1º+2º juntos
        if (pred.first_place === actual.first_place || pred.second_place === actual.second_place) {
          hasCorrectGroupResult = true;
          break;
        }
      }
    }
    if (hasCorrectGroupResult) {
      earned.push('guru');
    }
  }

  return earned;
}
