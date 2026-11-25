import type {
  EditalDeepAnalysis,
  EditalItem,
  SearchEditaisRequest,
  SearchEditaisResponse,
} from '../types/edital';

interface TedRow {
  tx_codigo_programa?: string;
  aa_ano_programa?: number;
  tx_nome_programa?: string;
  tx_nome_institucional_programa?: string;
  sigla_unidade_descentralizadora?: string;
  unidade_descentralizadora?: string;
  tx_objetivo_programa?: string;
  tx_descricao_programa?: string;
  in_chamamento_publico?: boolean;
  dt_recebimento_plano_chamamento_fim?: string | null;
  dt_recebimento_plano_beneficiario_fim?: string | null;
}

interface FafRow {
  ano_programa?: number;
  codigo_programa?: string;
  nome_programa?: string;
  nome_institucional_programa?: string;
  objetivo_programa?: string;
  descricao_programa?: string;
  data_fim_recebimento_planos_acao_beneficiarios_voluntarios?: string | null;
  data_fim_recebimento_planos_acao_beneficiarios_especificos?: string | null;
  data_fim_recebimento_planos_acao_beneficiarios_emendas?: string | null;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatBrDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

function getTodayIsoBr(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function clip(text: string | undefined | null, maxLen = 220): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= maxLen ? clean : `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}

export async function searchTransferegovClientFallback(
  params: SearchEditaisRequest,
): Promise<SearchEditaisResponse> {
  const todayIso = getTodayIsoBr();
  const tedUrl =
    `https://api.transferegov.gestao.gov.br/ted/programa` +
    `?tx_situacao_programa=eq.DISPONIBILIZADO` +
    `&or=(dt_recebimento_plano_chamamento_fim.gte.${todayIso},dt_recebimento_plano_beneficiario_fim.gte.${todayIso})` +
    `&order=id_programa.desc&limit=120`;

  const fafUrl =
    `https://api.transferegov.gestao.gov.br/fundoafundo/programa` +
    `?or=(data_fim_recebimento_planos_acao_beneficiarios_voluntarios.gte.${todayIso},data_fim_recebimento_planos_acao_beneficiarios_especificos.gte.${todayIso},data_fim_recebimento_planos_acao_beneficiarios_emendas.gte.${todayIso})` +
    `&order=ano_programa.desc,id_programa.desc&limit=40`;

  const [tedResp, fafResp] = await Promise.allSettled([
    fetch(tedUrl, { headers: { Accept: 'application/json' } }).then((r) =>
      r.ok ? (r.json() as Promise<TedRow[]>) : [],
    ),
    fetch(fafUrl, { headers: { Accept: 'application/json' } }).then((r) =>
      r.ok ? (r.json() as Promise<FafRow[]>) : [],
    ),
  ]);

  const tedRows = tedResp.status === 'fulfilled' && Array.isArray(tedResp.value) ? tedResp.value : [];
  const fafRows = fafResp.status === 'fulfilled' && Array.isArray(fafResp.value) ? fafResp.value : [];

  const candidates: Array<{ item: EditalItem; blob: string; scoreBase: number }> = [];

  for (const row of tedRows) {
    const codigo = (row.tx_codigo_programa || '').trim();
    const titulo = clip(row.tx_nome_programa || row.tx_nome_institucional_programa, 190);
    if (!codigo || !titulo) continue;

    const fim =
      row.dt_recebimento_plano_chamamento_fim && row.dt_recebimento_plano_chamamento_fim >= todayIso
        ? row.dt_recebimento_plano_chamamento_fim
        : row.dt_recebimento_plano_beneficiario_fim;
    if (!fim || fim < todayIso) continue;

    const orgao = clip(
      row.unidade_descentralizadora || row.sigla_unidade_descentralizadora || 'Governo Federal',
      130,
    );
    const sigla = (row.sigla_unidade_descentralizadora || '').toUpperCase();
    const prazoBr = formatBrDate(fim) || 'Fluxo Contínuo';

    candidates.push({
      item: {
        id: `TED-${codigo}`,
        orgao_emissor: sigla && !orgao.includes(sigla) ? `${orgao} (${sigla})` : orgao,
        titulo,
        resumo_objeto:
          clip(row.tx_objetivo_programa || row.tx_descricao_programa, 220) ||
          `Programa federal disponibilizado no Transferegov (${orgao}).`,
        elegibilidade: row.in_chamamento_publico
          ? 'Órgãos públicos, universidades federais e ICTs via Chamamento Público (TED)'
          : 'Órgãos e entidades da Administração Pública habilitados no Transferegov',
        valor_total_ou_teto: 'Não informado',
        prazo_submissao: `${prazoBr} até às 23:59`,
        fonte_recurso: 'Orçamento Geral da União — Transferegov (TED)',
        url_oficial: `https://api.transferegov.gestao.gov.br/ted/programa?tx_codigo_programa=eq.${encodeURIComponent(codigo)}`,
      },
      blob: normalize(
        `${titulo} ${orgao} ${sigla} ${row.tx_objetivo_programa || ''} ${row.tx_descricao_programa || ''}`,
      ),
      scoreBase: row.in_chamamento_publico ? 14 : 8,
    });
  }

  for (const row of fafRows) {
    const codigo = (row.codigo_programa || '').trim();
    const titulo = clip(row.nome_programa || row.nome_institucional_programa, 190);
    if (!codigo || !titulo) continue;

    const validDates = [
      row.data_fim_recebimento_planos_acao_beneficiarios_voluntarios,
      row.data_fim_recebimento_planos_acao_beneficiarios_especificos,
      row.data_fim_recebimento_planos_acao_beneficiarios_emendas,
    ].filter((d): d is string => Boolean(d && d >= todayIso));
    if (validDates.length === 0) continue;

    validDates.sort();
    const prazoBr = formatBrDate(validDates[validDates.length - 1]) || 'Fluxo Contínuo';

    candidates.push({
      item: {
        id: `FAF-${codigo}`,
        orgao_emissor: 'Governo Federal — Transferegov (Fundo a Fundo)',
        titulo,
        resumo_objeto:
          clip(row.objetivo_programa || row.descricao_programa, 220) ||
          'Transferência fundo a fundo para planos de ação de entes federativos.',
        elegibilidade: 'Estados, Distrito Federal e Municípios habilitados no Transferegov',
        valor_total_ou_teto: 'Não informado',
        prazo_submissao: `${prazoBr} até às 23:59`,
        fonte_recurso: 'Transferência Fundo a Fundo — Fundo Nacional (Transferegov)',
        url_oficial: `https://api.transferegov.gestao.gov.br/fundoafundo/programa?codigo_programa=eq.${encodeURIComponent(codigo)}`,
      },
      blob: normalize(`${titulo} ${row.objetivo_programa || ''} ${row.descricao_programa || ''}`),
      scoreBase: 10,
    });
  }

  const tokens = normalize(params.areaTematica)
    .split(' ')
    .filter((t) => t.length >= 3);

  const scored = candidates
    .map((c) => {
      let score = c.scoreBase;
      let hits = 0;
      for (const tok of tokens) {
        if (c.blob.includes(tok)) {
          score += 20;
          hits++;
        }
      }
      return { ...c, score, hits };
    })
    .filter((c) => (tokens.length > 0 ? c.hits > 0 : true));

  scored.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const editais: EditalItem[] = [];
  for (const entry of scored) {
    const key = normalize(entry.item.titulo).slice(0, 48);
    if (seen.has(key)) continue;
    seen.add(key);
    editais.push(entry.item);
    if (editais.length >= 12) break;
  }

  return {
    resultado: {
      total_encontrados: editais.length,
      data_consulta: todayIso,
      editais,
    },
    groundingSources: [
      {
        title: 'API Oficial Transferegov — Programas TED',
        uri: 'https://www.gov.br/transferegov/pt-br',
      },
      {
        title: 'Portal Transferegov — Termos de Execução Descentralizada',
        uri: 'https://ted.transferegov.sistema.gov.br/',
      },
    ],
    searchQueries: [
      'api.transferegov.gestao.gov.br/ted/programa (consulta direta no navegador)',
      'api.transferegov.gestao.gov.br/fundoafundo/programa (consulta direta no navegador)',
    ],
    aviso:
      'Modo estático ativo (sem servidor backend): consulta executada diretamente na API pública oficial do Transferegov com prazos vigentes.',
  };
}

export async function analyzeTransferegovClientFallback(
  urlOficial: string,
): Promise<EditalDeepAnalysis> {
  if (!urlOficial.startsWith('https://api.transferegov.gestao.gov.br/')) {
    throw new Error(
      'No modo estático (GitHub Pages), a leitura direta de requisitos está disponível para registros da API Transferegov. Abra a página oficial para consultar a íntegra.',
    );
  }

  const resp = await fetch(urlOficial, { headers: { Accept: 'application/json' } });
  if (!resp.ok) {
    throw new Error('Não foi possível consultar o registro oficial no Transferegov.');
  }
  const data = await resp.json();
  const record = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;

  const inicio = formatBrDate(
    String(
      record?.dt_recebimento_plano_chamamento_inicio ||
        record?.dt_recebimento_plano_beneficiario_inicio ||
        '',
    ),
  );
  const fim = formatBrDate(
    String(
      record?.dt_recebimento_plano_chamamento_fim ||
        record?.dt_recebimento_plano_beneficiario_fim ||
        record?.data_fim_recebimento_planos_acao_beneficiarios_voluntarios ||
        record?.data_fim_recebimento_planos_acao_beneficiarios_especificos ||
        '',
    ),
  );

  const cronograma: string[] = [];
  if (inicio) cronograma.push(`Início do recebimento: ${inicio}`);
  if (fim) cronograma.push(`Prazo final vigente: ${fim}`);

  return {
    contrapartida:
      'Conforme regras da modalidade no Transferegov e Lei de Diretrizes Orçamentárias (LDO).',
    documentos_exigidos: [
      'Plano de Trabalho / Plano de Ação cadastrado no portal Transferegov',
      'Habilitação e regularidade cadastral do ente no Transferegov / CAUC',
    ],
    cronograma_chaves:
      cronograma.length > 0 ? cronograma : ['Consulte o cronograma atualizado no portal Transferegov.'],
    etapas_submissao: [
      'Acessar o portal oficial Transferegov com conta Gov.br do gestor responsável.',
      `Pesquisar pelo código ${String(record?.tx_codigo_programa || record?.codigo_programa || 'oficial')}.`,
      'Preencher e enviar o plano de trabalho antes do encerramento do prazo.',
    ],
    pontos_atencao: [
      clip(
        String(record?.tx_objetivo_programa || record?.objetivo_programa || ''),
        260,
      ) || 'Confirme a elegibilidade do órgão proponente na íntegra do programa.',
    ],
    fontes_verificadas: [{ title: 'Registro Oficial Transferegov', uri: urlOficial }],
  };
}
