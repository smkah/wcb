-- 1. Criar tabelas para os palpites finais do torcedor e resultados reais
CREATE TABLE IF NOT EXISTS public.tournament_predictions (
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    champion TEXT,
    second_place TEXT,
    third_place TEXT,
    craque TEXT,
    artilheiro TEXT,
    best_attack TEXT,
    best_defense TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tournament_results (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    champion TEXT,
    second_place TEXT,
    third_place TEXT,
    craque TEXT,
    artilheiro TEXT,
    best_attack TEXT,
    best_defense TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-popular a tabela de resultados com uma única linha se ela não existir
INSERT INTO public.tournament_results (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS nas tabelas
ALTER TABLE public.tournament_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas para evitar erros de duplicata
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Predictions do torneio sao visiveis por todos" ON public.tournament_predictions;
    DROP POLICY IF EXISTS "Usuarios gerenciam seus palpites do torneio" ON public.tournament_predictions;
    DROP POLICY IF EXISTS "Resultados do torneio sao visiveis por todos" ON public.tournament_results;
    DROP POLICY IF EXISTS "Admin gerencia resultados do torneio" ON public.tournament_results;
END $$;

-- Criar políticas
CREATE POLICY "Predictions do torneio sao visiveis por todos" 
ON public.tournament_predictions FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios gerenciam seus palpites do torneio" 
ON public.tournament_predictions FOR ALL 
USING (auth.uid() = profile_id OR is_admin());

CREATE POLICY "Resultados do torneio sao visiveis por todos" 
ON public.tournament_results FOR SELECT 
USING (true);

CREATE POLICY "Admin gerencia resultados do torneio" 
ON public.tournament_results FOR ALL 
USING (is_admin());


-- 2. Atualizar função de recálculo de pontos do usuário para somar palpites finais
CREATE OR REPLACE FUNCTION public.recalculate_user_points(p_id UUID) 
RETURNS VOID AS $$
DECLARE
    g_pts_group_both INT;
    g_pts_group_first INT;
    g_pts_group_second INT;
    g_pts_group_third_qual INT;
BEGIN
    SELECT 
        COALESCE(g.points_group_both, 5),
        COALESCE(g.points_group_first, 3),
        COALESCE(g.points_group_second, 2),
        COALESCE(g.points_group_third_qual, 1)
    INTO 
        g_pts_group_both, g_pts_group_first, g_pts_group_second, g_pts_group_third_qual
    FROM public.group_members gm
    JOIN public.groups g ON gm.group_id = g.id
    WHERE gm.profile_id = p_id
    LIMIT 1;

    IF g_pts_group_both IS NULL THEN
        g_pts_group_both := 5;
        g_pts_group_first := 3;
        g_pts_group_second := 2;
        g_pts_group_third_qual := 1;
    END IF;

    UPDATE public.profiles p
    SET points = COALESCE(
        (SELECT SUM(points_earned) FROM public.guesses WHERE profile_id = p_id), 0
    ) + COALESCE(
        (
            SELECT SUM(
                calculate_group_points(
                    gp.first_place, gp.second_place, gp.third_place, gp.third_place_qualified,
                    gr.first_place, gr.second_place, gr.third_place, gr.third_place_qualified,
                    g_pts_group_both, g_pts_group_first, g_pts_group_second, g_pts_group_third_qual
                )
            )
            FROM public.group_predictions gp
            JOIN public.group_results gr ON gp.group_letter = gr.group_letter
            WHERE gp.profile_id = p_id
        ), 0
    ) + COALESCE(
        (
            SELECT 
                (CASE WHEN LOWER(TRIM(tp.champion)) = LOWER(TRIM(tr.champion)) THEN 15 ELSE 0 END) +
                (CASE WHEN LOWER(TRIM(tp.second_place)) = LOWER(TRIM(tr.second_place)) THEN 12 ELSE 0 END) +
                (CASE WHEN LOWER(TRIM(tp.third_place)) = LOWER(TRIM(tr.third_place)) THEN 10 ELSE 0 END) +
                (CASE WHEN LOWER(TRIM(tp.craque)) = LOWER(TRIM(tr.craque)) THEN 10 ELSE 0 END) +
                (CASE WHEN LOWER(TRIM(tp.artilheiro)) = LOWER(TRIM(tr.artilheiro)) THEN 8 ELSE 0 END) +
                (CASE WHEN LOWER(TRIM(tp.best_attack)) = LOWER(TRIM(tr.best_attack)) THEN 6 ELSE 0 END) +
                (CASE WHEN LOWER(TRIM(tp.best_defense)) = LOWER(TRIM(tr.best_defense)) THEN 6 ELSE 0 END)
            FROM public.tournament_predictions tp
            CROSS JOIN public.tournament_results tr
            WHERE tp.profile_id = p_id AND tr.id = 1
        ), 0
    )
    WHERE p.id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Trigger para recalcular pontos do usuário ao salvar palpite final
CREATE OR REPLACE FUNCTION public.trigger_on_tournament_prediction_saved()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.recalculate_user_points(OLD.profile_id);
        RETURN OLD;
    ELSE
        PERFORM public.recalculate_user_points(NEW.profile_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS on_tournament_prediction_saved ON public.tournament_predictions;
END $$;

CREATE TRIGGER on_tournament_prediction_saved
AFTER INSERT OR UPDATE OR DELETE ON public.tournament_predictions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_on_tournament_prediction_saved();


-- 4. Trigger para recalcular todos os pontos se o admin mudar resultados reais do torneio
CREATE OR REPLACE FUNCTION public.trigger_on_tournament_results_updated()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.recalculate_all_user_points();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS on_tournament_results_updated ON public.tournament_results;
END $$;

CREATE TRIGGER on_tournament_results_updated
AFTER INSERT OR UPDATE ON public.tournament_results
FOR EACH ROW
EXECUTE FUNCTION public.trigger_on_tournament_results_updated();


-- 5. Atualizar trigger_check_guess_deadline para liberar palpites em jogos sem placar
CREATE OR REPLACE FUNCTION public.trigger_check_guess_deadline()
RETURNS TRIGGER AS $$
DECLARE
    match_date TEXT;
    match_time TEXT;
    match_datetime TIMESTAMPTZ;
    score1_act INT;
    score2_act INT;
BEGIN
    -- Permitir que o Admin salve palpites mesmo após o início
    IF is_admin() THEN
        RETURN NEW;
    END IF;

    -- Permite atualizações se os palpites em si não mudaram (recalculando pontos, etc)
    IF TG_OP = 'UPDATE' AND 
       OLD.score1 = NEW.score1 AND 
       OLD.score2 = NEW.score2 AND 
       COALESCE(OLD.yellow_cards_winner, '') = COALESCE(NEW.yellow_cards_winner, '') AND 
       COALESCE(OLD.has_red_card, false) = COALESCE(NEW.has_red_card, false) THEN
        RETURN NEW;
    END IF;

    SELECT date, time, score1, score2 INTO match_date, match_time, score1_act, score2_act
    FROM public.matches
    WHERE id = NEW.match_id;
    
    IF FOUND THEN
        -- Se o jogo já tem placar definido, ele está concluído e trancado
        IF score1_act IS NOT NULL AND score2_act IS NOT NULL THEN
            RAISE EXCEPTION 'Este jogo já encerrou e foi concluído. Não é permitido salvar palpites.';
        END IF;

        -- Se não tem placar (não concluído), permitimos palpites!
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Trigger para propagação de chaveamento de mata-mata automático
CREATE OR REPLACE FUNCTION public.propagate_knockout_winner()
RETURNS TRIGGER AS $$
DECLARE
    v_winner TEXT;
    v_loser TEXT;
    v_team1 TEXT;
    v_team2 TEXT;
    v_score1 INT;
    v_score2 INT;
BEGIN
    v_team1 := NEW.team1;
    v_team2 := NEW.team2;
    v_score1 := NEW.score1;
    v_score2 := NEW.score2;

    -- Se o placar foi limpo (null), o vencedor/perdedor volta a ser o placeholder
    IF v_score1 IS NULL OR v_score2 IS NULL THEN
        IF NEW.id = 'm73' THEN UPDATE public.matches SET team1 = 'W73' WHERE id = 'm90';
        ELSIF NEW.id = 'm74' THEN UPDATE public.matches SET team1 = 'W74' WHERE id = 'm89';
        ELSIF NEW.id = 'm75' THEN UPDATE public.matches SET team2 = 'W75' WHERE id = 'm90';
        ELSIF NEW.id = 'm76' THEN UPDATE public.matches SET team1 = 'W76' WHERE id = 'm91';
        ELSIF NEW.id = 'm77' THEN UPDATE public.matches SET team2 = 'W77' WHERE id = 'm89';
        ELSIF NEW.id = 'm78' THEN UPDATE public.matches SET team2 = 'W78' WHERE id = 'm91';
        ELSIF NEW.id = 'm79' THEN UPDATE public.matches SET team1 = 'W79' WHERE id = 'm92';
        ELSIF NEW.id = 'm80' THEN UPDATE public.matches SET team2 = 'W80' WHERE id = 'm92';
        ELSIF NEW.id = 'm81' THEN UPDATE public.matches SET team1 = 'W81' WHERE id = 'm94';
        ELSIF NEW.id = 'm82' THEN UPDATE public.matches SET team2 = 'W82' WHERE id = 'm94';
        ELSIF NEW.id = 'm83' THEN UPDATE public.matches SET team1 = 'W83' WHERE id = 'm93';
        ELSIF NEW.id = 'm84' THEN UPDATE public.matches SET team2 = 'W84' WHERE id = 'm93';
        ELSIF NEW.id = 'm85' THEN UPDATE public.matches SET team1 = 'W85' WHERE id = 'm96';
        ELSIF NEW.id = 'm86' THEN UPDATE public.matches SET team1 = 'W86' WHERE id = 'm95';
        ELSIF NEW.id = 'm87' THEN UPDATE public.matches SET team2 = 'W87' WHERE id = 'm96';
        ELSIF NEW.id = 'm88' THEN UPDATE public.matches SET team2 = 'W88' WHERE id = 'm95';
        
        ELSIF NEW.id = 'm89' THEN UPDATE public.matches SET team1 = 'W89' WHERE id = 'm97';
        ELSIF NEW.id = 'm90' THEN UPDATE public.matches SET team2 = 'W90' WHERE id = 'm97';
        ELSIF NEW.id = 'm91' THEN UPDATE public.matches SET team1 = 'W91' WHERE id = 'm99';
        ELSIF NEW.id = 'm92' THEN UPDATE public.matches SET team2 = 'W92' WHERE id = 'm99';
        ELSIF NEW.id = 'm93' THEN UPDATE public.matches SET team1 = 'W93' WHERE id = 'm98';
        ELSIF NEW.id = 'm94' THEN UPDATE public.matches SET team2 = 'W94' WHERE id = 'm98';
        ELSIF NEW.id = 'm95' THEN UPDATE public.matches SET team1 = 'W95' WHERE id = 'm100';
        ELSIF NEW.id = 'm96' THEN UPDATE public.matches SET team2 = 'W96' WHERE id = 'm100';
        
        ELSIF NEW.id = 'm97' THEN UPDATE public.matches SET team1 = 'W97' WHERE id = 'm101';
        ELSIF NEW.id = 'm98' THEN UPDATE public.matches SET team2 = 'W98' WHERE id = 'm101';
        ELSIF NEW.id = 'm99' THEN UPDATE public.matches SET team1 = 'W99' WHERE id = 'm102';
        ELSIF NEW.id = 'm100' THEN UPDATE public.matches SET team2 = 'W100' WHERE id = 'm102';
        
        ELSIF NEW.id = 'm101' THEN 
            UPDATE public.matches SET team1 = 'W101' WHERE id = 'm104';
            UPDATE public.matches SET team1 = 'L101' WHERE id = 'm103';
        ELSIF NEW.id = 'm102' THEN 
            UPDATE public.matches SET team2 = 'W102' WHERE id = 'm104';
            UPDATE public.matches SET team2 = 'L102' WHERE id = 'm103';
        END IF;
        
        RETURN NEW;
    END IF;

    -- Caso contrário, determina o vencedor
    IF v_score1 > v_score2 THEN
        v_winner := v_team1;
        v_loser := v_team2;
    ELSE
        v_winner := v_team2;
        v_loser := v_team1;
    END IF;

    -- Propagar vencedor
    IF NEW.id = 'm73' THEN UPDATE public.matches SET team1 = v_winner WHERE id = 'm90';
    ELSIF NEW.id = 'm74' THEN UPDATE public.matches SET team1 = v_winner WHERE id = 'm89';
    ELSIF NEW.id = 'm75' THEN UPDATE public.matches SET team2 = v_winner WHERE id = 'm90';
    ELSIF NEW.id = 'm76' THEN UPDATE public.matches SET team1 = v_winner WHERE id = 'm91';
    ELSIF NEW.id = 'm77' THEN UPDATE public.matches SET team2 = v_winner WHERE id = 'm89';
    ELSIF NEW.id = 'm78' THEN UPDATE public.matches SET team2 = v_winner WHERE id = 'm91';
    ELSIF NEW.id = 'm79' THEN UPDATE public.matches SET team1 = v_winner WHERE id = 'm92';
    ELSIF NEW.id = 'm80' THEN UPDATE public.matches SET team2 = v_winner WHERE id = 'm92';
    ELSIF NEW.id = 'm81' THEN UPDATE public.matches SET team1 = v_winner WHERE id = 'm94';
    ELSIF NEW.id = 'm82' THEN UPDATE public.matches SET team2 = v_winner WHERE id = 'm94';
    ELSIF NEW.id = 'm83' THEN UPDATE public.matches SET team1 = v_winner WHERE id = 'm93';
    ELSIF NEW.id = 'm84' THEN UPDATE public.matches SET team2 = v_winner WHERE id = 'm93';
    ELSIF NEW.id = 'm85' THEN UPDATE public.matches SET team1 = v_winner WHERE id = 'm96';
    ELSIF NEW.id = 'm86' THEN UPDATE public.matches SET team1 = v_winner WHERE id = 'm95';
    ELSIF NEW.id = 'm87' THEN UPDATE public.matches SET team2 = v_winner WHERE id = 'm96';
    ELSIF NEW.id = 'm88' THEN UPDATE public.matches SET team2 = v_winner WHERE id = 'm95';
    
    ELSIF NEW.id = 'm89' THEN UPDATE public.matches SET team1 = v_winner WHERE id = 'm97';
    ELSIF NEW.id = 'm90' THEN UPDATE public.matches SET team2 = v_winner WHERE id = 'm97';
    ELSIF NEW.id = 'm91' THEN UPDATE public.matches SET team1 = v_winner WHERE id = 'm99';
    ELSIF NEW.id = 'm92' THEN UPDATE public.matches SET team2 = v_winner WHERE id = 'm99';
    ELSIF NEW.id = 'm93' THEN UPDATE public.matches SET team1 = v_winner WHERE id = 'm98';
    ELSIF NEW.id = 'm94' THEN UPDATE public.matches SET team2 = v_winner WHERE id = 'm98';
    ELSIF NEW.id = 'm95' THEN UPDATE public.matches SET team1 = v_winner WHERE id = 'm100';
    ELSIF NEW.id = 'm96' THEN UPDATE public.matches SET team2 = v_winner WHERE id = 'm100';
    
    ELSIF NEW.id = 'm97' THEN UPDATE public.matches SET team1 = v_winner WHERE id = 'm101';
    ELSIF NEW.id = 'm98' THEN UPDATE public.matches SET team2 = v_winner WHERE id = 'm101';
    ELSIF NEW.id = 'm99' THEN UPDATE public.matches SET team1 = v_winner WHERE id = 'm102';
    ELSIF NEW.id = 'm100' THEN UPDATE public.matches SET team2 = v_winner WHERE id = 'm102';
    
    ELSIF NEW.id = 'm101' THEN 
        UPDATE public.matches SET team1 = v_winner WHERE id = 'm104';
        UPDATE public.matches SET team1 = v_loser WHERE id = 'm103';
    ELSIF NEW.id = 'm102' THEN 
        UPDATE public.matches SET team2 = v_winner WHERE id = 'm104';
        UPDATE public.matches SET team2 = v_loser WHERE id = 'm103';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS on_match_winner_propagate ON public.matches;
END $$;

CREATE TRIGGER on_match_winner_propagate
AFTER UPDATE OF score1, score2 ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.propagate_knockout_winner();


-- 7. Trigger para bloquear palpites Finais & Extras após o prazo (09/07/2026 às 11:59 BRT)
CREATE OR REPLACE FUNCTION public.trigger_check_tournament_prediction_deadline()
RETURNS TRIGGER AS $$
BEGIN
    -- Permitir que o Admin salve palpites mesmo após o início
    IF is_admin() THEN
        RETURN NEW;
    END IF;

    IF NOW() > '2026-07-09 11:59:00-03'::TIMESTAMPTZ THEN
        RAISE EXCEPTION 'O prazo para salvar palpites finais e extras encerrou em 09/07/2026 às 11:59.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS check_tournament_prediction_deadline ON public.tournament_predictions;
END $$;

CREATE TRIGGER check_tournament_prediction_deadline
BEFORE INSERT OR UPDATE ON public.tournament_predictions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_tournament_prediction_deadline();
