import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const team1 = searchParams.get('team1') || '';
  const team2 = searchParams.get('team2') || '';

  if (!team1 && !team2) {
    return NextResponse.json({ error: 'Faltando parâmetros de busca' }, { status: 400 });
  }

  // Montar uma busca focada na Copa do Mundo e nas seleções
  const query = `Copa do Mundo 2026 ${team1} ${team2}`.trim();
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-150`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 300 }, // Cache por 5 minutos
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch RSS feed: ${res.statusText}`);
    }

    const xmlText = await res.text();
    const articles = [];

    // Regex simples e robusto para extrair os itens
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null && articles.length < 6) {
      const itemContent = match[1];

      const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = itemContent.match(/<source[^>]*>([\s\S]*?)<\/source>/);

      let title = titleMatch ? titleMatch[1] : 'Sem título';
      let link = linkMatch ? linkMatch[1] : '#';
      let pubDate = pubDateMatch ? pubDateMatch[1] : '';
      let source = sourceMatch ? sourceMatch[1] : 'Notícias';

      // Limpar CDATA e decodificar entidades HTML básicas
      const cleanCDATA = (str: string) => {
        return str
          .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      };

      title = cleanCDATA(title);
      link = cleanCDATA(link);
      pubDate = cleanCDATA(pubDate);
      source = cleanCDATA(source);

      // Limpar o nome do veículo do título se estiver no final (Ex: "Título - Globo Esporte")
      const sourceIndex = title.lastIndexOf(` - ${source}`);
      if (sourceIndex !== -1) {
        title = title.substring(0, sourceIndex);
      }

      // Formatar data relativa ou simplificada
      let formattedDate = pubDate;
      try {
        const dateObj = new Date(pubDate);
        if (!isNaN(dateObj.getTime())) {
          formattedDate = dateObj.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      } catch (e) {
        // Fallback
      }

      articles.push({
        title,
        link,
        date: formattedDate,
        source
      });
    }

    return NextResponse.json({ articles });
  } catch (error: any) {
    console.error('Erro ao buscar notícias:', error);
    return NextResponse.json({ error: 'Erro ao buscar notícias', details: error.message }, { status: 500 });
  }
}
