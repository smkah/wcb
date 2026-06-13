import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get('league') || '1'; // Copa do Mundo
  const season = searchParams.get('season') || '2026';
  const live = searchParams.get('live');

  // Obtém a chave da requisição ou do ambiente
  const apiKey = process.env.API_FOOTBALL_KEY || 
                 process.env.NEXT_PUBLIC_API_FOOTBALL_KEY || 
                 request.headers.get('x-api-key') || '';

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Chave da API-Football não configurada no ambiente (.env) ou enviada na requisição.' }, 
      { status: 400 }
    );
  }

  // Define a URL de consulta do API-Football
  let url = `https://v3.football.api-sports.io/fixtures?league=${league}&season=${season}`;
  if (live === 'true') {
    url += '&live=all';
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
      },
      next: { revalidate: 60 } // Cache de 1 minuto
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `API-Football retornou erro: ${res.status} ${res.statusText}` }, 
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Falha ao buscar dados na API-Football.' }, 
      { status: 500 }
    );
  }
}
