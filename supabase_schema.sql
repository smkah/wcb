-- 1. Tabela de Perfis (Profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    points INTEGER DEFAULT 0,
    ranking_position INTEGER,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Partidas (Matches)
CREATE TABLE IF NOT EXISTS public.matches (
    id TEXT PRIMARY KEY,
    team1 TEXT NOT NULL,
    team2 TEXT NOT NULL,
    score1 INTEGER,
    score2 INTEGER,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    "group" TEXT,
    round TEXT NOT NULL,
    ground TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Bolões (Groups)
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_by UUID NOT NULL CONSTRAINT groups_created_by_fkey REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar colunas de configuração caso não existam (Migração)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='groups' AND COLUMN_NAME='points_winner') THEN
        ALTER TABLE public.groups ADD COLUMN points_winner INTEGER DEFAULT 3;
        ALTER TABLE public.groups ADD COLUMN points_exact INTEGER DEFAULT 5;
        ALTER TABLE public.groups ADD COLUMN points_first_half INTEGER DEFAULT 2;
        ALTER TABLE public.groups ADD COLUMN custom_rules JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='avatar_url') THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='guesses' AND COLUMN_NAME='custom_guesses') THEN
        ALTER TABLE public.guesses ADD COLUMN custom_guesses JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 4. Tabela de Membros de Grupos (Group Members)
CREATE TABLE IF NOT EXISTS public.group_members (
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, profile_id)
);

-- 5. Tabela de Palpites (Guesses)
CREATE TABLE IF NOT EXISTS public.guesses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    match_id TEXT REFERENCES public.matches(id),
    score1 INTEGER NOT NULL,
    score2 INTEGER NOT NULL,
    custom_guesses JSONB DEFAULT '{}'::jsonb,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, match_id)
);

-- CONFIGURAÇÃO DE SEGURANÇA (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guesses ENABLE ROW LEVEL SECURITY;

-- Funções Auxiliares
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = auth.uid()) = 'samukahweb@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Limpar políticas existentes para evitar erros de duplicata na execução
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Profiles são visíveis por todos" ON public.profiles;
    DROP POLICY IF EXISTS "Usuários podem criar seu próprio perfil" ON public.profiles;
    DROP POLICY IF EXISTS "Usuários podem editar seu próprio perfil" ON public.profiles;
    DROP POLICY IF EXISTS "Admin pode gerenciar perfis" ON public.profiles;
    DROP POLICY IF EXISTS "Partidas são visíveis por todos" ON public.matches;
    DROP POLICY IF EXISTS "Admin pode gerenciar partidas" ON public.matches;
    DROP POLICY IF EXISTS "Grupos são visíveis por todos autenticados" ON public.groups;
    DROP POLICY IF EXISTS "Usuários podem criar grupos" ON public.groups;
    DROP POLICY IF EXISTS "Criador pode gerenciar seu grupo" ON public.groups;
    DROP POLICY IF EXISTS "Membros são visíveis por todos autenticados" ON public.group_members;
    DROP POLICY IF EXISTS "Usuários podem entrar em grupos" ON public.group_members;
    DROP POLICY IF EXISTS "Usuários podem sair de grupos" ON public.group_members;
    DROP POLICY IF EXISTS "Admin pode gerenciar membros" ON public.group_members;
    DROP POLICY IF EXISTS "Palpites são privados ao dono" ON public.guesses;
    DROP POLICY IF EXISTS "Usuários podem criar/editar seus palpites" ON public.guesses;
    DROP POLICY IF EXISTS "Admin pode gerenciar palpites" ON public.guesses;
END $$;

-- Recriar POLÍTICAS 
CREATE POLICY "Profiles são visíveis por todos" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Usuários podem criar seu próprio perfil" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuários podem editar seu próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin pode gerenciar perfis" ON public.profiles FOR ALL USING (is_admin());

CREATE POLICY "Partidas são visíveis por todos" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Admin pode gerenciar partidas" ON public.matches FOR ALL USING (is_admin());

CREATE POLICY "Grupos são visíveis por todos autenticados" ON public.groups FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Usuários podem criar grupos" ON public.groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Criador pode gerenciar seu grupo" ON public.groups FOR ALL USING (auth.uid() = created_by OR is_admin());

CREATE POLICY "Membros são visíveis por todos autenticados" ON public.group_members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Usuários podem entrar em grupos" ON public.group_members FOR INSERT WITH CHECK (auth.uid() = profile_id OR is_admin());
CREATE POLICY "Usuários podem sair de grupos" ON public.group_members FOR DELETE USING (auth.uid() = profile_id OR is_admin());
CREATE POLICY "Admin pode gerenciar membros" ON public.group_members FOR ALL USING (is_admin());

CREATE POLICY "Palpites são privados ao dono" ON public.guesses FOR SELECT USING (auth.uid() = profile_id OR is_admin());
CREATE POLICY "Usuários podem criar/editar seus palpites" ON public.guesses FOR ALL USING (auth.uid() = profile_id OR is_admin());
CREATE POLICY "Admin pode gerenciar palpites" ON public.guesses FOR ALL USING (is_admin());

-- TRIGGER PARA CRIAR PERFIL NO SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, points)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 0)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Configuração do Storage para Avatars
-- Criar bucket 'avatars' caso não exista
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Limpar políticas de storage existentes para evitar erros de duplicata
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Avatars são públicos" ON storage.objects;
    DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Usuários podem deletar seus próprios avatars" ON storage.objects;
END $$;

-- Criar políticas de RLS para o bucket 'avatars'
CREATE POLICY "Avatars são públicos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Usuários autenticados podem fazer upload de avatars" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários podem atualizar seus próprios avatars" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários podem deletar seus próprios avatars" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- 7. Novas Regras de Pontuação (Fase de Grupos, Standings, Cartões)

-- Adicionar colunas se não existirem
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='matches' AND COLUMN_NAME='yellow_cards_winner') THEN
        ALTER TABLE public.matches ADD COLUMN yellow_cards_winner TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='matches' AND COLUMN_NAME='has_red_card') THEN
        ALTER TABLE public.matches ADD COLUMN has_red_card BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='guesses' AND COLUMN_NAME='yellow_cards_winner') THEN
        ALTER TABLE public.guesses ADD COLUMN yellow_cards_winner TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='guesses' AND COLUMN_NAME='has_red_card') THEN
        ALTER TABLE public.guesses ADD COLUMN has_red_card BOOLEAN;
    END IF;
END $$;

-- Tabela de Palpites de Classificação de Grupos
CREATE TABLE IF NOT EXISTS public.group_predictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_letter TEXT NOT NULL,
    first_place TEXT,
    second_place TEXT,
    third_place TEXT,
    third_place_qualified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, group_letter)
);

-- Tabela de Resultados Reais dos Grupos
CREATE TABLE IF NOT EXISTS public.group_results (
    group_letter TEXT PRIMARY KEY,
    first_place TEXT,
    second_place TEXT,
    third_place TEXT,
    third_place_qualified BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.group_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_results ENABLE ROW LEVEL SECURITY;

-- Limpar e recriar políticas para evitar duplicados
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Predictions são visíveis por todos autenticados" ON public.group_predictions;
    DROP POLICY IF EXISTS "Usuários podem gerenciar seus palpites de grupo" ON public.group_predictions;
    DROP POLICY IF EXISTS "Resultados de grupos são visíveis por todos" ON public.group_results;
    DROP POLICY IF EXISTS "Admin pode gerenciar resultados de grupos" ON public.group_results;
END $$;

-- Criar Políticas de Segurança (RLS)
CREATE POLICY "Predictions são visíveis por todos autenticados" 
ON public.group_predictions FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem gerenciar seus palpites de grupo" 
ON public.group_predictions FOR ALL 
USING (auth.uid() = profile_id OR is_admin());

CREATE POLICY "Resultados de grupos são visíveis por todos" 
ON public.group_results FOR SELECT 
USING (true);

CREATE POLICY "Admin pode gerenciar resultados de grupos" 
ON public.group_results FOR ALL 
USING (is_admin());

-- Prepopula a tabela de resultados de grupos de A a L
INSERT INTO public.group_results (group_letter)
VALUES ('A'), ('B'), ('C'), ('D'), ('E'), ('F'), ('G'), ('H'), ('I'), ('J'), ('K'), ('L')
ON CONFLICT (group_letter) DO NOTHING;

-- Adicionar novas colunas de configuração de pontuação à tabela groups
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='groups' AND COLUMN_NAME='points_yellow_cards') THEN
        ALTER TABLE public.groups ADD COLUMN points_yellow_cards INTEGER DEFAULT 3;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='groups' AND COLUMN_NAME='points_red_card') THEN
        ALTER TABLE public.groups ADD COLUMN points_red_card INTEGER DEFAULT 4;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='groups' AND COLUMN_NAME='points_group_both') THEN
        ALTER TABLE public.groups ADD COLUMN points_group_both INTEGER DEFAULT 5;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='groups' AND COLUMN_NAME='points_group_first') THEN
        ALTER TABLE public.groups ADD COLUMN points_group_first INTEGER DEFAULT 3;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='groups' AND COLUMN_NAME='points_group_second') THEN
        ALTER TABLE public.groups ADD COLUMN points_group_second INTEGER DEFAULT 2;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='groups' AND COLUMN_NAME='points_group_third_qual') THEN
        ALTER TABLE public.groups ADD COLUMN points_group_third_qual INTEGER DEFAULT 1;
    END IF;
END $$;

-- Função para calcular pontos de partidas individuais com pesos dinâmicos
CREATE OR REPLACE FUNCTION calculate_match_points(
    score1_act INT, score2_act INT, yellow_act TEXT, red_act BOOLEAN,
    score1_guess INT, score2_guess INT, yellow_guess TEXT, red_guess BOOLEAN,
    pts_winner INT, pts_exact INT, pts_yellow INT, pts_red INT
) RETURNS INT AS $$
DECLARE
    pts INT := 0;
BEGIN
    IF score1_act IS NULL OR score2_act IS NULL THEN
        RETURN 0;
    END IF;

    -- Placar exato
    IF score1_act = score1_guess AND score2_act = score2_guess THEN
        pts := pts + pts_exact;
    -- Resultado correto
    ELSIF (score1_act > score2_act AND score1_guess > score2_guess) OR
          (score1_act < score2_act AND score1_guess < score2_guess) OR
          (score1_act = score2_act AND score1_guess = score2_guess) THEN
        pts := pts + pts_winner;
    END IF;

    -- Time com mais cartões amarelos
    IF yellow_act IS NOT NULL AND yellow_guess IS NOT NULL AND yellow_act = yellow_guess THEN
        pts := pts + pts_yellow;
    END IF;

    -- Teve cartão vermelho
    IF red_act IS NOT NULL AND red_guess IS NOT NULL AND red_act = red_guess THEN
        pts := pts + pts_red;
    END IF;

    RETURN pts;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para calcular pontos de classificação do grupo com pesos dinâmicos
CREATE OR REPLACE FUNCTION calculate_group_points(
    p_first TEXT, p_second TEXT, p_third TEXT, p_third_qual BOOLEAN,
    a_first TEXT, a_second TEXT, a_third TEXT, a_third_qual BOOLEAN,
    pts_both INT, pts_first INT, pts_second INT, pts_third INT
) RETURNS INT AS $$
DECLARE
    pts INT := 0;
BEGIN
    IF a_first IS NULL OR a_second IS NULL THEN
        RETURN 0;
    END IF;

    -- 1º e 2º corretos
    IF p_first = a_first AND p_second = a_second THEN
        pts := pts + pts_both;
    -- Apenas 1º correto
    ELSIF p_first = a_first THEN
        pts := pts + pts_first;
    -- Apenas 2º correto
    ELSIF p_second = a_second THEN
        pts := pts + pts_second;
    END IF;

    -- Melhor terceiro classificado
    IF p_third_qual = true AND a_third_qual = true AND p_third = a_third THEN
        pts := pts + pts_third;
    END IF;

    RETURN pts;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para recalcular os pontos de um usuário específico
CREATE OR REPLACE FUNCTION recalculate_user_points(p_id UUID) 
RETURNS VOID AS $$
DECLARE
    g_pts_group_both INT;
    g_pts_group_first INT;
    g_pts_group_second INT;
    g_pts_group_third_qual INT;
BEGIN
    -- Obter os pesos do bolão do usuário para os pontos de grupo
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
    )
    WHERE p.id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Função para recalcular todos os pontos de usuários com pesos dinâmicos por bolão
CREATE OR REPLACE FUNCTION recalculate_all_user_points() 
RETURNS VOID AS $$
DECLARE
    r RECORD;
    g_pts_winner INT;
    g_pts_exact INT;
    g_pts_yellow INT;
    g_pts_red INT;
BEGIN
    FOR r IN SELECT id FROM public.profiles LOOP
        -- Buscar configurações do primeiro bolão do usuário, senão usar os defaults
        SELECT 
            COALESCE(g.points_winner, 2),
            COALESCE(g.points_exact, 5),
            COALESCE(g.points_yellow_cards, 3),
            COALESCE(g.points_red_card, 4)
        INTO 
            g_pts_winner, g_pts_exact, g_pts_yellow, g_pts_red
        FROM public.group_members gm
        JOIN public.groups g ON gm.group_id = g.id
        WHERE gm.profile_id = r.id
        LIMIT 1;

        -- Fallback se o usuário não estiver em nenhum bolão
        IF g_pts_winner IS NULL THEN
            g_pts_winner := 2;
            g_pts_exact := 5;
            g_pts_yellow := 3;
            g_pts_red := 4;
        END IF;

        -- 1. Recalcular palpites de partidas do usuário
        UPDATE public.guesses g
        SET points_earned = calculate_match_points(
            m.score1, m.score2, m.yellow_cards_winner, m.has_red_card,
            g.score1, g.score2, g.yellow_cards_winner, g.has_red_card,
            g_pts_winner, g_pts_exact, g_pts_yellow, g_pts_red
        )
        FROM public.matches m
        WHERE g.match_id = m.id AND g.profile_id = r.id;

        -- 2. Recalcular total de pontos do perfil (soma de palpites de partidas + classificação)
        PERFORM recalculate_user_points(r.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 1. Trigger BEFORE INSERT OR UPDATE ON guesses para calcular points_earned na linha
CREATE OR REPLACE FUNCTION trigger_update_guess_points()
RETURNS TRIGGER AS $$
DECLARE
    m RECORD;
    g_pts_winner INT;
    g_pts_exact INT;
    g_pts_yellow INT;
    g_pts_red INT;
BEGIN
    SELECT score1, score2, yellow_cards_winner, has_red_card 
    INTO m 
    FROM public.matches 
    WHERE id = NEW.match_id;

    IF FOUND THEN
        SELECT 
            COALESCE(g.points_winner, 2),
            COALESCE(g.points_exact, 5),
            COALESCE(g.points_yellow_cards, 3),
            COALESCE(g.points_red_card, 4)
        INTO 
            g_pts_winner, g_pts_exact, g_pts_yellow, g_pts_red
        FROM public.group_members gm
        JOIN public.groups g ON gm.group_id = g.id
        WHERE gm.profile_id = NEW.profile_id
        LIMIT 1;

        IF g_pts_winner IS NULL THEN
            g_pts_winner := 2;
            g_pts_exact := 5;
            g_pts_yellow := 3;
            g_pts_red := 4;
        END IF;

        NEW.points_earned := calculate_match_points(
            m.score1, m.score2, m.yellow_cards_winner, m.has_red_card,
            NEW.score1, NEW.score2, NEW.yellow_cards_winner, NEW.has_red_card,
            g_pts_winner, g_pts_exact, g_pts_yellow, g_pts_red
        );
    ELSE
        NEW.points_earned := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger AFTER INSERT OR UPDATE OR DELETE ON guesses para atualizar pontos do perfil
CREATE OR REPLACE FUNCTION trigger_update_profile_points_on_guess()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM recalculate_user_points(OLD.profile_id);
        RETURN OLD;
    ELSE
        PERFORM recalculate_user_points(NEW.profile_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger AFTER UPDATE ON matches para recalcular palpites daquela partida
CREATE OR REPLACE FUNCTION trigger_on_match_updated()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.score1 IS DISTINCT FROM NEW.score1) OR 
       (OLD.score2 IS DISTINCT FROM NEW.score2) OR 
       (OLD.yellow_cards_winner IS DISTINCT FROM NEW.yellow_cards_winner) OR 
       (OLD.has_red_card IS DISTINCT FROM NEW.has_red_card) THEN
        
        UPDATE public.guesses
        SET updated_at = NOW()
        WHERE match_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger AFTER INSERT OR UPDATE OR DELETE ON group_predictions
CREATE OR REPLACE FUNCTION trigger_on_group_prediction_saved()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM recalculate_user_points(OLD.profile_id);
        RETURN OLD;
    ELSE
        PERFORM recalculate_user_points(NEW.profile_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger AFTER UPDATE ON group_results
CREATE OR REPLACE FUNCTION trigger_on_group_results_updated()
RETURNS TRIGGER AS $$
DECLARE
    r RECORD;
BEGIN
    IF (OLD.first_place IS DISTINCT FROM NEW.first_place) OR 
       (OLD.second_place IS DISTINCT FROM NEW.second_place) OR 
       (OLD.third_place IS DISTINCT FROM NEW.third_place) OR 
       (OLD.third_place_qualified IS DISTINCT FROM NEW.third_place_qualified) THEN
       
        FOR r IN SELECT DISTINCT profile_id FROM public.group_predictions WHERE group_letter = NEW.group_letter LOOP
            PERFORM recalculate_user_points(r.profile_id);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger AFTER INSERT OR DELETE ON group_members
CREATE OR REPLACE FUNCTION trigger_on_group_member_changed()
RETURNS TRIGGER AS $$
DECLARE
    v_profile_id UUID;
BEGIN
    v_profile_id := COALESCE(NEW.profile_id, OLD.profile_id);
    
    UPDATE public.guesses
    SET updated_at = NOW()
    WHERE profile_id = v_profile_id;
    
    PERFORM recalculate_user_points(v_profile_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger AFTER UPDATE ON groups
CREATE OR REPLACE FUNCTION trigger_on_group_updated()
RETURNS TRIGGER AS $$
DECLARE
    r RECORD;
BEGIN
    IF (OLD.points_winner IS DISTINCT FROM NEW.points_winner) OR
       (OLD.points_exact IS DISTINCT FROM NEW.points_exact) OR
       (OLD.points_yellow_cards IS DISTINCT FROM NEW.points_yellow_cards) OR
       (OLD.points_red_card IS DISTINCT FROM NEW.points_red_card) OR
       (OLD.points_group_both IS DISTINCT FROM NEW.points_group_both) OR
       (OLD.points_group_first IS DISTINCT FROM NEW.points_group_first) OR
       (OLD.points_group_second IS DISTINCT FROM NEW.points_group_second) OR
       (OLD.points_group_third_qual IS DISTINCT FROM NEW.points_group_third_qual) THEN
       
        FOR r IN SELECT profile_id FROM public.group_members WHERE group_id = NEW.id LOOP
            UPDATE public.guesses
            SET updated_at = NOW()
            WHERE profile_id = r.profile_id;
            
            PERFORM recalculate_user_points(r.profile_id);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Dropar e recriar todos os triggers
DO $$ 
BEGIN
    DROP TRIGGER IF EXISTS on_guess_points_update ON public.guesses;
    DROP TRIGGER IF EXISTS on_guess_profile_update ON public.guesses;
    DROP TRIGGER IF EXISTS on_match_updated ON public.matches;
    DROP TRIGGER IF EXISTS on_group_prediction_saved ON public.group_predictions;
    DROP TRIGGER IF EXISTS on_group_results_updated ON public.group_results;
    DROP TRIGGER IF EXISTS on_group_member_changed ON public.group_members;
    DROP TRIGGER IF EXISTS on_group_updated ON public.groups;
    
    -- Remover o trigger antigo recursivo
    DROP TRIGGER IF EXISTS on_guess_saved ON public.guesses;
    DROP TRIGGER IF EXISTS on_group_results_updated ON public.group_results;
END $$;

-- Recriar Triggers
CREATE TRIGGER on_guess_points_update
BEFORE INSERT OR UPDATE ON public.guesses
FOR EACH ROW
EXECUTE FUNCTION trigger_update_guess_points();

CREATE TRIGGER on_guess_profile_update
AFTER INSERT OR UPDATE OR DELETE ON public.guesses
FOR EACH ROW
EXECUTE FUNCTION trigger_update_profile_points_on_guess();

CREATE TRIGGER on_match_updated
AFTER UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION trigger_on_match_updated();

CREATE TRIGGER on_group_prediction_saved
AFTER INSERT OR UPDATE OR DELETE ON public.group_predictions
FOR EACH ROW
EXECUTE FUNCTION trigger_on_group_prediction_saved();

CREATE TRIGGER on_group_results_updated
AFTER UPDATE ON public.group_results
FOR EACH ROW
EXECUTE FUNCTION trigger_on_group_results_updated();

CREATE TRIGGER on_group_member_changed
AFTER INSERT OR DELETE ON public.group_members
FOR EACH ROW
EXECUTE FUNCTION trigger_on_group_member_changed();

CREATE TRIGGER on_group_updated
AFTER UPDATE ON public.groups
FOR EACH ROW
EXECUTE FUNCTION trigger_on_group_updated();

-- 8. Validadores de Prazos de Palpites (Deadlines)

-- Função para validar se o jogo já iniciou antes de salvar um palpite
CREATE OR REPLACE FUNCTION trigger_check_guess_deadline()
RETURNS TRIGGER AS $$
DECLARE
    match_date TEXT;
    match_time TEXT;
    match_datetime TIMESTAMPTZ;
BEGIN
    -- Permitir que o Admin salve palpites mesmo após o início (se necessário para ajustes manuais)
    IF is_admin() THEN
        RETURN NEW;
    END IF;

    SELECT date, time INTO match_date, match_time
    FROM public.matches
    WHERE id = NEW.match_id;
    
    IF FOUND THEN
        BEGIN
            match_datetime := (match_date || ' ' || COALESCE(match_time, '00:00'))::TIMESTAMPTZ;
        EXCEPTION WHEN OTHERS THEN
            match_datetime := (match_date || ' 00:00')::TIMESTAMPTZ;
        END;

        IF NOW() > match_datetime THEN
            RAISE EXCEPTION 'Este jogo já iniciou. Não é permitido salvar palpites.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para validar o prazo dos palpites de classificação de grupos
CREATE OR REPLACE FUNCTION trigger_check_group_predictions_deadline()
RETURNS TRIGGER AS $$
DECLARE
    deadline TIMESTAMPTZ;
BEGIN
    -- Permitir que o Admin gerencie palpites após o prazo
    IF is_admin() THEN
        RETURN NEW;
    END IF;

    -- Obter o encerramento do último jogo da primeira rodada (2 jogos de cada grupo A-L)
    SELECT (date || ' ' || COALESCE(time, '00:00'))::TIMESTAMPTZ + INTERVAL '2 hours' INTO deadline
    FROM (
        SELECT date, time, "group",
               ROW_NUMBER() OVER(PARTITION BY "group" ORDER BY date, time) as rn
        FROM public.matches
        WHERE "group" IS NOT NULL
    ) sub
    WHERE rn <= 2
    ORDER BY date, time DESC
    LIMIT 1;

    IF deadline IS NOT NULL AND NOW() > deadline THEN
        RAISE EXCEPTION 'O prazo para palpites da fase de grupos já expirou (fim da primeira rodada).';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Dropar triggers antigos de prazo se existirem
DO $$
BEGIN
    DROP TRIGGER IF EXISTS check_guess_deadline_trigger ON public.guesses;
    DROP TRIGGER IF EXISTS check_group_predictions_deadline_trigger ON public.group_predictions;
END $$;

-- Criar Triggers de Verificação de Prazo (BEFORE para bloquear a gravação)
CREATE TRIGGER check_guess_deadline_trigger
BEFORE INSERT OR UPDATE ON public.guesses
FOR EACH ROW
EXECUTE FUNCTION trigger_check_guess_deadline();

CREATE TRIGGER check_group_predictions_deadline_trigger
BEFORE INSERT OR UPDATE ON public.group_predictions
FOR EACH ROW
EXECUTE FUNCTION trigger_check_group_predictions_deadline();
