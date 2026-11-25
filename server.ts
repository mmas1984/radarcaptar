import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, type GenerateContentResponse } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import type {
  EditalDeepAnalysis,
  EditalItem,
  EditaisJsonPayload,
  GroundingSource,
  SearchEditaisResponse,
} from './src/types/edital.ts';
import {
  analyzeOfficialUrlDirectly,
  searchOfficialBrazilianPortals,
} from './src/server/officialPortals.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_CANDIDATES = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const searchCache = new Map<string, { expiresAt: number; payload: SearchEditaisResponse }>();
const inFlightSearches = new Map<string, Promise<SearchEditaisResponse>>();

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getBrazilDateIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function sanitizeInput(value: unknown, maxLen = 200): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function isSafePublicHttpUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      !hostname ||
      hostname === 'localhost' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('169.254.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.includes(':')
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function extractJsonObject(rawText: string): Record<string, unknown> | null {
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const candidate = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isDeadlineExpired(prazo: string, referenceDateIso: string): boolean {
  const lower = prazo.toLowerCase();
  if (
    lower.includes('fluxo contínuo') ||
    lower.includes('fluxo continuo') ||
    lower.includes('permanente') ||
    lower.includes('em breve') ||
    lower.includes('a definir')
  ) {
    return false;
  }

  const matches = [...prazo.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
  if (matches.length === 0) return false;

  const latestMatch = matches[matches.length - 1];
  const day = Number(latestMatch[1]);
  const month = Number(latestMatch[2]);
  const year = Number(latestMatch[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const deadlineIso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return deadlineIso < referenceDateIso;
}

function extractGroundingMetadata(response: GenerateContentResponse): {
  sources: GroundingSource[];
  queries: string[];
} {
  const metadata = response.candidates?.[0]?.groundingMetadata;
  const rawChunks = metadata?.groundingChunks ?? [];
  const seenUris = new Set<string>();
  const sources: GroundingSource[] = [];

  for (const chunk of rawChunks) {
    const web = chunk.web;
    if (!web?.uri) continue;
    const safeUri = isSafePublicHttpUrl(web.uri);
    if (!safeUri || seenUris.has(safeUri)) continue;
    seenUris.add(safeUri);
    sources.push({
      title: sanitizeInput(web.title || new URL(safeUri).hostname, 140),
      uri: safeUri,
    });
  }

  const queries = (metadata?.webSearchQueries ?? [])
    .map((q) => sanitizeInput(q, 160))
    .filter(Boolean);

  return { sources, queries };
}

function isQuotaOrTransientError(error: unknown): {
  isQuota: boolean;
  isTransient: boolean;
  isNotFound: boolean;
} {
  const msg = error instanceof Error ? error.message : String(error);
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;

  const isQuota =
    status === 429 ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429') ||
    msg.toLowerCase().includes('quota');

  const isTransient =
    status === 503 ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT');

  const isNotFound = status === 404 || msg.includes('NOT_FOUND') || msg.includes('404');

  return { isQuota, isTransient, isNotFound };
}

async function tryGeminiGrounded(params: {
  contents: string;
  systemInstruction: string;
  tools: Array<Record<string, unknown>>;
}): Promise<GenerateContentResponse | null> {
  const ai = getAiClient();
  if (!ai) return null;

  for (const model of MODEL_CANDIDATES) {
    try {
      const config: Record<string, unknown> = {
        systemInstruction: params.systemInstruction,
        tools: params.tools,
      };
      if (model === 'gemini-4-hydrogen') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }
      return await ai.models.generateContent({
        model,
        contents: params.contents,
        config,
      });
    } catch (error) {
      const { isQuota, isTransient, isNotFound } = isQuotaOrTransientError(error);
      if (isQuota || isTransient || isNotFound) {
        continue;
      }
      throw error;
    }
  }

  return null;
}

function mapGeminiError(error: unknown): { status: number; message: string } {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg === 'UNSUPPORTED_OFFICIAL_HOST') {
    return {
      status: 400,
      message:
        'A leitura direta de requisitos aceita apenas domínios institucionais oficiais (.gov.br, FAPs e organismos internacionais).',
    };
  }
  if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
    return {
      status: 403,
      message:
        'Falha de autenticação com o serviço de busca. Verifique sua chave de API em Settings > Secrets.',
    };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || msg.toLowerCase().includes('quota')) {
    return {
      status: 429,
      message:
        'A cota temporária da API foi atingida. Aguarde alguns instantes e tente novamente ou selecione uma chave com faturamento ativo em Settings > Secrets.',
    };
  }
  return {
    status: 500,
    message: 'Não foi possível concluir a consulta em tempo real. Tente novamente.',
  };
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, data_consulta: getBrazilDateIso() });
  });

  app.post('/api/search-editais', async (req: Request, res: Response) => {
    try {
      const areaTematica = sanitizeInput(req.body?.areaTematica, 160);
      const tipoEnte =
        sanitizeInput(req.body?.tipoEnte, 140) ||
        'Entes públicos municipais, estaduais e consórcios públicos';
      const estadoRegiao = sanitizeInput(req.body?.estadoRegiao, 100) || 'Todo o Brasil (Nacional)';
      const fonteFoco = sanitizeInput(req.body?.fonteFoco, 120);

      const dataConsulta = getBrazilDateIso();
      const cacheKey = JSON.stringify([
        dataConsulta,
        areaTematica.toLowerCase(),
        tipoEnte.toLowerCase(),
        estadoRegiao.toLowerCase(),
        fonteFoco.toLowerCase(),
      ]);

      const cached = searchCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.json(cached.payload);
        return;
      }

      const existingFlight = inFlightSearches.get(cacheKey);
      if (existingFlight) {
        const sharedPayload = await existingFlight;
        res.json(sharedPayload);
        return;
      }

      const [anoAtual, mesAtual, diaAtual] = dataConsulta.split('-');
      const dataBrasilFormatada = `${diaAtual}/${mesAtual}/${anoAtual}`;

      const systemInstruction = `[PAPEL]
Você é um Rastreador e Analista Especialista em Captação de Recursos e Editais Públicos no Brasil, com acesso à busca na web em tempo real via Google Search.

[CONTEXTO]
O usuário necessita de informações precisas, atualizadas e com prazos vigentes sobre editais, chamadas públicas e programas de financiamento de projetos destinados a entes públicos municipais, estaduais, consórcios públicos, autarquias e ICTs no território brasileiro (ex.: Transferegov, BNDES, FINEP, Ministérios, Fundações Estaduais de Amparo à Pesquisa/FAPs e organismos internacionais atuando no Brasil).

[DATA DE REFERÊNCIA]
Hoje é ${dataBrasilFormatada} (${dataConsulta}).

[REGRAS E RESTRIÇÕES CRÍTICAS]
1. ZERO ALUCINAÇÃO DE LINKS: Retorne única e exclusivamente URLs reais encontradas diretamente nos resultados da busca do Google Search desta sessão. Jamais deduza, invente ou tente reconstruir URLs da memória.
2. Se o link direto do documento PDF não estiver evidente nos resultados da busca, forneça a URL exata da página oficial de publicação do chamamento no órgão emissor ou plataforma oficial (.gov.br, bndes.gov.br, finep.gov.br, fapesp.br, etc.).
3. VIGÊNCIA OBRIGATÓRIA: Descarte rigorosamente qualquer edital cujo prazo de submissão já tenha expirado antes de ${dataBrasilFormatada}. Inclua apenas editais com inscrições abertas, futuras ou em Fluxo Contínuo.
4. PRECISÃO FACTUAL: Não invente valores, prazos ou números de edital. Se o valor não constar explicitamente na página encontrada, preencha "Não informado".
5. Se nenhuma oportunidade vigente for encontrada com os filtros fornecidos, retorne "total_encontrados": 0 e "editais": [].
6. Retorne a resposta ESTRITAMENTE como um único objeto JSON válido, sem texto antes ou depois, seguindo exatamente a estrutura solicitada.`;

      const fonteClause =
        fonteFoco && fonteFoco !== 'Todas as fontes oficiais'
          ? `\nPrioridade de fontes/órgãos: ${fonteFoco}`
          : '';

      const userPrompt = `Realize busca ativa na web em tempo real por editais públicos, chamadas públicas, seleções do Novo PAC, programas no Transferegov, chamadas FINEP, BNDES, Ministérios, FAPs ou organismos internacionais com inscrições abertas, futuras ou em fluxo contínuo em ${dataBrasilFormatada}.

[ENTRADAS DO USUÁRIO]
Área Temática: ${areaTematica || 'Geral (todos os temas de interesse público)'}
Ente / Proponente: ${tipoEnte}
Estado / Região de interesse: ${estadoRegiao}${fonteClause}

Busque resultados reais e recentes de ${anoAtual} (ou com prazo vigente a partir de ${dataBrasilFormatada}). Priorize páginas oficiais de publicação de editais e retorne entre 4 e 10 oportunidades reais vigentes, caso existam.

[FORMATO DE SAÍDA ESTRITO - APENAS JSON]
{
  "total_encontrados": 0,
  "data_consulta": "${dataConsulta}",
  "editais": [
    {
      "id": "identificador_unico_ou_numero_edital",
      "orgao_emissor": "Nome da Instituição/Ministério",
      "titulo": "Título oficial da chamada pública",
      "resumo_objeto": "Descrição concisa (máximo 2 linhas) do que é financiado",
      "elegibilidade": "Quem pode propor (ex: Prefeituras, Consórcios, Estados)",
      "valor_total_ou_teto": "Ex: R$ 500.000,00 por proposta (ou 'Não informado')",
      "prazo_submissao": "DD/MM/AAAA até às HH:mm (ou 'Fluxo Contínuo')",
      "fonte_recurso": "Fundo Nacional, Repasse a fundo perdido, Financiamento, etc.",
      "url_oficial": "https://link-real-da-pagina-do-edital.gov.br"
    }
  ]
}`;

      const runSearch = async (): Promise<SearchEditaisResponse> => {
        // 1. Primary path: Gemini with Google Search grounding (used when quota is available)
        const geminiResponse = await tryGeminiGrounded({
          contents: userPrompt,
          systemInstruction,
          tools: [{ googleSearch: {} }],
        });

        let payload: SearchEditaisResponse | null = null;

        if (geminiResponse) {
          const rawText = geminiResponse.text ?? '';
          const { sources, queries } = extractGroundingMetadata(geminiResponse);
          const parsed = extractJsonObject(rawText);

          if (parsed && Array.isArray(parsed.editais)) {
            const seenIds = new Set<string>();
            const validEditais: EditalItem[] = [];
            let expiredFilteredCount = 0;

            for (let idx = 0; idx < parsed.editais.length; idx++) {
              const raw = parsed.editais[idx];
              if (!raw || typeof raw !== 'object') continue;
              const item = raw as Record<string, unknown>;

              const safeUrl = isSafePublicHttpUrl(item.url_oficial);
              const titulo = sanitizeInput(item.titulo, 240);
              const orgao = sanitizeInput(item.orgao_emissor, 160);
              const prazo = sanitizeInput(item.prazo_submissao, 120) || 'Não informado';

              if (!safeUrl || !titulo || !orgao) continue;

              if (isDeadlineExpired(prazo, dataConsulta)) {
                expiredFilteredCount++;
                continue;
              }

              let id = sanitizeInput(item.id, 80) || `edital-${idx + 1}`;
              if (seenIds.has(id)) {
                id = `${id}-${idx + 1}`;
              }
              seenIds.add(id);

              validEditais.push({
                id,
                orgao_emissor: orgao,
                titulo,
                resumo_objeto:
                  sanitizeInput(item.resumo_objeto, 360) ||
                  'Objeto detalhado na página oficial do edital.',
                elegibilidade: sanitizeInput(item.elegibilidade, 200) || tipoEnte,
                valor_total_ou_teto:
                  sanitizeInput(item.valor_total_ou_teto, 140) || 'Não informado',
                prazo_submissao: prazo,
                fonte_recurso: sanitizeInput(item.fonte_recurso, 140) || 'Não informado',
                url_oficial: safeUrl,
              });
            }

            const resultado: EditaisJsonPayload = {
              total_encontrados: validEditais.length,
              data_consulta: dataConsulta,
              editais: validEditais,
            };

            const aviso =
              validEditais.length === 0
                ? 'Nenhuma chamada aberta com prazo vigente foi confirmada para os filtros informados no momento.'
                : expiredFilteredCount > 0
                  ? `${expiredFilteredCount} chamada(s) com prazo encerrado foram descartadas automaticamente na validação de vigência.`
                  : undefined;

            payload = {
              resultado,
              groundingSources: sources,
              searchQueries: queries,
              aviso,
            };
          }
        }

        // 2. Resilient Real-Time Official Government APIs path (Transferegov TED, Fundo a Fundo, Especiais & FAPESP)
        // Activates automatically when Google Search grounding quota is temporarily exhausted
        if (!payload) {
          payload = await searchOfficialBrazilianPortals({
            areaTematica,
            tipoEnte,
            estadoRegiao,
            fonteFoco,
            dataConsulta,
          });
        }

        searchCache.set(cacheKey, {
          expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
          payload,
        });
        if (searchCache.size > 50) {
          const oldestKey = searchCache.keys().next().value;
          if (oldestKey) searchCache.delete(oldestKey);
        }

        return payload;
      };

      const flightPromise = runSearch().finally(() => {
        inFlightSearches.delete(cacheKey);
      });
      inFlightSearches.set(cacheKey, flightPromise);

      const payload = await flightPromise;
      res.json(payload);
    } catch (error) {
      const mapped = mapGeminiError(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  app.post('/api/analyze-edital', async (req: Request, res: Response) => {
    try {
      const titulo = sanitizeInput(req.body?.titulo, 240);
      const orgaoEmissor = sanitizeInput(req.body?.orgaoEmissor, 160);
      const safeUrl = isSafePublicHttpUrl(req.body?.urlOficial);

      if (!titulo || !safeUrl) {
        res
          .status(400)
          .json({ error: 'Informe um título e uma URL oficial válida (http/https) para análise.' });
        return;
      }

      const prompt = `Analise o edital público brasileiro abaixo consultando diretamente a página oficial e resultados de busca complementares:
Título: ${titulo}
Órgão Emissor: ${orgaoEmissor || 'Não especificado'}
URL Oficial: ${safeUrl}

Extraia de forma objetiva e estritamente factual (sem inventar dados) os requisitos críticos para gestores públicos. Se algum item não constar na fonte consultada, informe explicitamente "Não especificado na página consultada".

Retorne ESTRITAMENTE um único objeto JSON válido sem texto fora do JSON:
{
  "contrapartida": "Exigência de contrapartida financeira/econômica ou isenção",
  "documentos_exigidos": ["Documento ou certidão 1", "Documento 2"],
  "cronograma_chaves": ["Data e marco 1", "Data e marco 2"],
  "etapas_submissao": ["Passo prático 1 para inscrição", "Passo 2"],
  "pontos_atencao": ["Critério eliminatório ou alerta crítico 1", "Alerta 2"]
}`;

      const geminiResponse = await tryGeminiGrounded({
        contents: prompt,
        systemInstruction:
          'Você é um especialista sênior em captação de recursos públicos no Brasil (Transferegov, BNDES, FINEP, FAPs). Responda estritamente em JSON válido com base apenas em dados verificados na URL oficial ou Google Search.',
        tools: [{ urlContext: {} }, { googleSearch: {} }],
      });

      if (geminiResponse) {
        const rawText = geminiResponse.text ?? '';
        const { sources } = extractGroundingMetadata(geminiResponse);
        const parsed = extractJsonObject(rawText);

        const toStringArray = (val: unknown): string[] => {
          if (!Array.isArray(val)) return [];
          return val
            .map((entry) => sanitizeInput(entry, 280))
            .filter(Boolean)
            .slice(0, 8);
        };

        const analysis: EditalDeepAnalysis = {
          contrapartida:
            sanitizeInput(parsed?.contrapartida, 260) ||
            'Não especificado na página consultada — verifique a íntegra do edital.',
          documentos_exigidos: toStringArray(parsed?.documentos_exigidos),
          cronograma_chaves: toStringArray(parsed?.cronograma_chaves),
          etapas_submissao: toStringArray(parsed?.etapas_submissao),
          pontos_atencao: toStringArray(parsed?.pontos_atencao),
          fontes_verificadas: sources,
        };

        res.json(analysis);
        return;
      }

      // Direct real-time fetch and structured parsing of the verified official URL
      const directAnalysis = await analyzeOfficialUrlDirectly(safeUrl);
      res.json(directAnalysis);
    } catch (error) {
      const mapped = mapGeminiError(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Radar Capta server running on http://0.0.0.0:${PORT}`);
  });
}

createApp();
