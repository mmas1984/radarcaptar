import type {
  EditalDeepAnalysis,
  EditalItem,
  GroundingSource,
  SearchEditaisResponse,
} from '../types/edital.ts';

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

interface TedPrograma {
  id_programa?: number;
  tx_codigo_programa?: string;
  aa_ano_programa?: number;
  tx_situacao_programa?: string;
  tx_nome_programa?: string;
  sigla_unidade_descentralizadora?: string;
  unidade_descentralizadora?: string;
  tx_nome_institucional_programa?: string;
  tx_objetivo_programa?: string;
  tx_descricao_programa?: string;
  in_chamamento_publico?: boolean;
  in_beneficiario_especifico?: boolean;
  dt_recebimento_plano_chamamento_inicio?: string | null;
  dt_recebimento_plano_chamamento_fim?: string | null;
  dt_recebimento_plano_beneficiario_inicio?: string | null;
  dt_recebimento_plano_beneficiario_fim?: string | null;
}

interface FafPrograma {
  id_programa?: number;
  ano_programa?: number;
  modalidade_programa?: string;
  codigo_programa?: string;
  nome_programa?: string;
  nome_institucional_programa?: string;
  objetivo_programa?: string;
  descricao_programa?: string;
  data_fim_recebimento_planos_acao_beneficiarios_voluntarios?: string | null;
  data_fim_recebimento_planos_acao_beneficiarios_especificos?: string | null;
  data_fim_recebimento_planos_acao_beneficiarios_emendas?: string | null;
  nome_gestao_agil_programa?: string;
}

interface EspPrograma {
  id_programa?: number;
  ano_programa?: number;
  codigo_programa?: string;
  sigla_orgao_superior_programa?: string;
  nome_orgao_superior_programa?: string;
  nome_orgao_programa?: string;
  data_inicio_ciencia_programa?: string | null;
  data_fim_ciencia_programa?: string | null;
  valor_total_disponibilizado_programa?: number | null;
  valor_a_disponibilizar_programa?: number | null;
}

interface CandidateEdital {
  item: EditalItem;
  searchBlob: string;
  sourceKind: 'transferegov' | 'fndct' | 'fapesp';
  isChamamentoPublico: boolean;
  year: number;
  rawDetails?: string;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(input: string): string {
  const named: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&aacute;': 'á',
    '&agrave;': 'à',
    '&acirc;': 'â',
    '&atilde;': 'ã',
    '&eacute;': 'é',
    '&ecirc;': 'ê',
    '&iacute;': 'í',
    '&oacute;': 'ó',
    '&ocirc;': 'ô',
    '&otilde;': 'õ',
    '&uacute;': 'ú',
    '&ccedil;': 'ç',
    '&Aacute;': 'Á',
    '&Acirc;': 'Â',
    '&Atilde;': 'Ã',
    '&Eacute;': 'É',
    '&Ecirc;': 'Ê',
    '&Iacute;': 'Í',
    '&Oacute;': 'Ó',
    '&Otilde;': 'Õ',
    '&Uacute;': 'Ú',
    '&Ccedil;': 'Ç',
    '&ndash;': '–',
    '&mdash;': '—',
    '&ldquo;': '“',
    '&rdquo;': '”',
  };

  return input
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&[a-zA-Z]+;/g, (entity) => named[entity] ?? entity);
}

function cleanSnippet(text: string | undefined | null, maxLen = 240): string {
  if (!text) return '';
  const cleaned = decodeHtmlEntities(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trimEnd()}…`;
}

function formatIsoToBrDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function brDateToIso(br: string): string | null {
  const match = br.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function formatCurrencyBrl(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 'Não informado';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value);
}

const THEMATIC_EXPANSIONS: Record<string, string[]> = {
  saneamento: ['saneamento', 'agua', 'esgoto', 'hidric', 'residuo', 'drenagem', 'cidades', 'infraestrutura', 'regional', 'obras', 'secas'],
  infraestrutura: ['infraestrutura', 'obras', 'mobilidade', 'urbana', 'cidades', 'regional', 'ordenamento', 'territorial', 'transporte', 'estrutur'],
  mobilidade: ['mobilidade', 'transporte', 'urbana', 'cidades', 'viario', 'infraestrutura', 'logistica'],
  saude: ['saude', 'sus', 'hospital', 'medic', 'vacin', 'vigilancia', 'enferm', 'biomedic', 'clinica', 'sanitari'],
  educacao: ['educacao', 'escolar', 'ensino', 'universidade', 'capacitacao', 'formacao', 'docente', 'pedagog', 'pesquisa', 'pos graduacao'],
  ambiente: ['ambiente', 'ambiental', 'clima', 'climatic', 'sustentav', 'amazonia', 'florest', 'agua', 'energia', 'ecolog', 'carbono', 'residuo'],
  clima: ['clima', 'climatic', 'ambiental', 'sustentav', 'desastre', 'risco', 'secas', 'amazonia', 'energia', 'ecolog'],
  inovacao: ['inovacao', 'tecnologia', 'ciencia', 'cientific', 'pesquisa', 'fndct', 'digital', 'inteligente', 'fapesp', 'desenvolvimento tecnologico'],
  agricultura: ['agricultura', 'agrario', 'agro', 'rural', 'familiar', 'abastecimento', 'conab', 'pesca', 'aquicultura', 'alimento', 'pecuaria'],
  seguranca: ['seguranca', 'senasp', 'polici', 'violencia', 'crime', 'penal', 'defesa civil', 'risco', 'justica', 'mulher', 'fraude'],
  cultura: ['cultura', 'patrimonio', 'memoria', 'museu', 'criativa', 'arte', 'editorial', 'comunicacao'],
  social: ['social', 'assistencia', 'familia', 'cuidados', 'habitacao', 'inclusao', 'fome', 'direitos', 'mulher', 'comunidade'],
  habitacao: ['habitacao', 'moradia', 'periferia', 'cidades', 'urbana', 'risco', 'regularizacao'],
};

const STOP_WORDS = new Set([
  'para', 'com', 'sem', 'dos', 'das', 'nos', 'nas', 'por', 'que', 'uma', 'uns', 'umas',
  'entre', 'sobre', 'mais', 'todos', 'todas', 'geral', 'publico', 'publica', 'publicos',
  'edital', 'editais', 'chamada', 'chamadas', 'programa', 'programas', 'projeto', 'projetos',
]);

function expandSearchTokens(areaTematica: string): string[] {
  const norm = normalizeText(areaTematica);
  if (!norm) return [];
  const rawTokens = norm.split(' ').filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  const expanded = new Set<string>(rawTokens);

  for (const token of rawTokens) {
    for (const [key, synonyms] of Object.entries(THEMATIC_EXPANSIONS)) {
      if (token.includes(key) || key.includes(token)) {
        for (const syn of synonyms) expanded.add(syn);
      }
    }
  }
  return [...expanded];
}

async function fetchTransferegovTed(todayIso: string): Promise<CandidateEdital[]> {
  const url =
    `https://api.transferegov.gestao.gov.br/ted/programa` +
    `?tx_situacao_programa=eq.DISPONIBILIZADO` +
    `&or=(dt_recebimento_plano_chamamento_fim.gte.${todayIso},dt_recebimento_plano_beneficiario_fim.gte.${todayIso})` +
    `&order=id_programa.desc&limit=250`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) return [];
  const rows = (await response.json()) as TedPrograma[];
  if (!Array.isArray(rows)) return [];

  const candidates: CandidateEdital[] = [];
  for (const row of rows) {
    const codigo = (row.tx_codigo_programa || '').trim();
    const titulo = cleanSnippet(row.tx_nome_programa || row.tx_nome_institucional_programa, 200);
    const orgao = cleanSnippet(
      row.unidade_descentralizadora || row.sigla_unidade_descentralizadora || 'Governo Federal (Transferegov)',
      140,
    );
    if (!codigo || !titulo) continue;

    const fimChamamento = row.dt_recebimento_plano_chamamento_fim;
    const fimBeneficiario = row.dt_recebimento_plano_beneficiario_fim;
    const bestIso =
      fimChamamento && fimChamamento >= todayIso
        ? fimChamamento
        : fimBeneficiario && fimBeneficiario >= todayIso
          ? fimBeneficiario
          : null;
    if (!bestIso) continue;

    const prazoBr = formatIsoToBrDate(bestIso) || 'Fluxo Contínuo';
    const isChamamento = Boolean(row.in_chamamento_publico || (fimChamamento && fimChamamento >= todayIso));
    const sigla = (row.sigla_unidade_descentralizadora || '').toUpperCase();
    const isFndct = sigla === 'FNDCT' || normalizeText(orgao).includes('fndct');

    const objetivo = cleanSnippet(row.tx_objetivo_programa || row.tx_descricao_programa, 230);
    const elegibilidade = isChamamento
      ? 'Órgãos públicos, universidades federais, ICTs e entidades elegíveis via Chamamento Público (TED)'
      : 'Órgãos e entidades da Administração Pública habilitados no Transferegov (TED)';

    const item: EditalItem = {
      id: `TED-${codigo}`,
      orgao_emissor: sigla && !orgao.includes(sigla) ? `${orgao} (${sigla})` : orgao,
      titulo,
      resumo_objeto: objetivo || `Programa federal disponibilizado no Transferegov (${orgao}).`,
      elegibilidade,
      valor_total_ou_teto: 'Não informado',
      prazo_submissao: `${prazoBr} até às 23:59`,
      fonte_recurso: isFndct
        ? 'FNDCT / Termo de Execução Descentralizada (Transferegov)'
        : 'Orçamento Geral da União — Transferegov (TED)',
      url_oficial: `https://api.transferegov.gestao.gov.br/ted/programa?tx_codigo_programa=eq.${encodeURIComponent(codigo)}`,
    };

    candidates.push({
      item,
      searchBlob: normalizeText(
        `${titulo} ${orgao} ${sigla} ${row.tx_objetivo_programa || ''} ${row.tx_descricao_programa || ''}`,
      ),
      sourceKind: isFndct ? 'fndct' : 'transferegov',
      isChamamentoPublico: isChamamento,
      year: row.aa_ano_programa || 2026,
      rawDetails: row.tx_descricao_programa || row.tx_objetivo_programa || '',
    });
  }

  return candidates;
}

async function fetchTransferegovFundoAFundo(todayIso: string): Promise<CandidateEdital[]> {
  const url =
    `https://api.transferegov.gestao.gov.br/fundoafundo/programa` +
    `?or=(data_fim_recebimento_planos_acao_beneficiarios_voluntarios.gte.${todayIso},data_fim_recebimento_planos_acao_beneficiarios_especificos.gte.${todayIso},data_fim_recebimento_planos_acao_beneficiarios_emendas.gte.${todayIso})` +
    `&order=ano_programa.desc,id_programa.desc&limit=80`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) return [];
  const rows = (await response.json()) as FafPrograma[];
  if (!Array.isArray(rows)) return [];

  const candidates: CandidateEdital[] = [];
  for (const row of rows) {
    const codigo = (row.codigo_programa || '').trim();
    const titulo = cleanSnippet(row.nome_programa || row.nome_institucional_programa, 200);
    if (!codigo || !titulo) continue;

    const dates = [
      row.data_fim_recebimento_planos_acao_beneficiarios_voluntarios,
      row.data_fim_recebimento_planos_acao_beneficiarios_especificos,
      row.data_fim_recebimento_planos_acao_beneficiarios_emendas,
    ].filter((d): d is string => Boolean(d && d >= todayIso));
    if (dates.length === 0) continue;

    dates.sort();
    const bestIso = dates[dates.length - 1];
    const prazoBr = formatIsoToBrDate(bestIso) || 'Fluxo Contínuo';

    const objetivo = cleanSnippet(row.objetivo_programa || row.descricao_programa, 230);
    const gestao = cleanSnippet(row.nome_gestao_agil_programa, 80);
    const isSeguranca = normalizeText(`${titulo} ${objetivo} ${gestao}`).includes('seguranca') ||
      normalizeText(`${titulo} ${objetivo}`).includes('violencia') ||
      normalizeText(`${titulo} ${objetivo}`).includes('penal');

    const orgao = isSeguranca
      ? 'Ministério da Justiça e Segurança Pública (MJSP / Transferegov)'
      : 'Governo Federal — Transferegov (Fundo a Fundo)';

    const item: EditalItem = {
      id: `FAF-${codigo}`,
      orgao_emissor: orgao,
      titulo,
      resumo_objeto: objetivo || 'Transferência fundo a fundo para planos de ação de entes federativos.',
      elegibilidade: 'Estados, Distrito Federal e Municípios com fundos habilitados no Transferegov',
      valor_total_ou_teto: 'Não informado',
      prazo_submissao: `${prazoBr} até às 23:59`,
      fonte_recurso: 'Transferência Fundo a Fundo — Fundo Nacional (Transferegov)',
      url_oficial: `https://api.transferegov.gestao.gov.br/fundoafundo/programa?codigo_programa=eq.${encodeURIComponent(codigo)}`,
    };

    candidates.push({
      item,
      searchBlob: normalizeText(`${titulo} ${orgao} ${objetivo} ${row.descricao_programa || ''} ${gestao}`),
      sourceKind: 'transferegov',
      isChamamentoPublico: Boolean(row.data_fim_recebimento_planos_acao_beneficiarios_voluntarios),
      year: row.ano_programa || 2026,
      rawDetails: row.descricao_programa || row.objetivo_programa || '',
    });
  }

  return candidates;
}

async function fetchTransferegovEspeciais(todayIso: string): Promise<CandidateEdital[]> {
  const url =
    `https://api.transferegov.gestao.gov.br/transferenciasespeciais/programa_especial` +
    `?data_fim_ciencia_programa=gte.${todayIso}&order=ano_programa.desc,id_programa.desc&limit=25`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return [];
  const rows = (await response.json()) as EspPrograma[];
  if (!Array.isArray(rows)) return [];

  const candidates: CandidateEdital[] = [];
  for (const row of rows) {
    const codigo = (row.codigo_programa || '').trim();
    if (!codigo || !row.data_fim_ciencia_programa || row.data_fim_ciencia_programa < todayIso) continue;
    const orgao = cleanSnippet(
      row.nome_orgao_programa || row.nome_orgao_superior_programa || 'Ministério da Gestão e da Inovação (MGI)',
      140,
    );
    const prazoBr = formatIsoToBrDate(row.data_fim_ciencia_programa) || 'Não informado';
    const valor = formatCurrencyBrl(
      row.valor_total_disponibilizado_programa || row.valor_a_disponibilizar_programa,
    );

    const item: EditalItem = {
      id: `ESP-${codigo}`,
      orgao_emissor: orgao,
      titulo: `Programa de Transferências Especiais ${row.ano_programa || ''} (${codigo})`.trim(),
      resumo_objeto:
        'Repasses diretos de transferências especiais para custeio e investimento de municípios, estados e Distrito Federal via Transferegov.',
      elegibilidade: 'Prefeituras / Municípios, Estados e Distrito Federal',
      valor_total_ou_teto: valor,
      prazo_submissao: `${prazoBr} até às 23:59`,
      fonte_recurso: 'Transferências Especiais da União (Transferegov)',
      url_oficial: `https://api.transferegov.gestao.gov.br/transferenciasespeciais/programa_especial?codigo_programa=eq.${encodeURIComponent(codigo)}`,
    };

    candidates.push({
      item,
      searchBlob: normalizeText(`${item.titulo} ${orgao} municipios prefeituras estados investimento infraestrutura`),
      sourceKind: 'transferegov',
      isChamamentoPublico: true,
      year: row.ano_programa || 2026,
    });
  }

  return candidates;
}

async function fetchFapespOportunidades(todayIso: string): Promise<CandidateEdital[]> {
  const url = 'https://fapesp.br/oportunidades/';
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) return [];
  const html = await response.text();

  const matches = [...html.matchAll(/<li class="box_col aberta[^"]*">([\s\S]*?)<\/li>/gi)];
  const candidates: CandidateEdital[] = [];

  for (let i = 0; i < Math.min(matches.length, 60); i++) {
    const block = matches[i][1];
    const hrefMatch = block.match(/<a[^>]+href="([^"]+)"/i);
    const titleMatch = block.match(/<strong class="title">([\s\S]*?)<\/strong>/i);
    const instMatch = block.match(/<strong>Institui(?:ç|&ccedil;)ão:<\/strong>\s*([^<]+)/i);
    const cityMatch = block.match(/<strong>Cidade:<\/strong>\s*([^<]+)/i);
    const deadlineMatch = block.match(/<strong>Inscri(?:ç|&ccedil;)(?:õ|&otilde;)es at(?:é|&eacute;):<\/strong>\s*(\d{2}\/\d{2}\/\d{4})/i);
    const resumoMatch = block.match(/<span class="text-resumo">([\s\S]*?)<\/span>/i);

    if (!hrefMatch || !titleMatch || !deadlineMatch) continue;
    const deadlineBr = deadlineMatch[1];
    const deadlineIso = brDateToIso(deadlineBr);
    if (!deadlineIso || deadlineIso < todayIso) continue;

    const rawPath = hrefMatch[1].replace(/^\/Control\/\.\.\//, '');
    const fullUrl = rawPath.startsWith('http')
      ? rawPath
      : `https://fapesp.br/oportunidades/${rawPath.replace(/^\/+/, '')}`;

    const idMatch = fullUrl.match(/\/(\d+)\/?$/);
    const id = idMatch ? `FAPESP-${idMatch[1]}` : `FAPESP-${i + 1}`;
    const titulo = cleanSnippet(titleMatch[1], 190);
    const inst = cleanSnippet(instMatch?.[1], 130);
    const city = cleanSnippet(cityMatch?.[1], 60);
    const resumo = cleanSnippet(resumoMatch?.[1], 220);

    const item: EditalItem = {
      id,
      orgao_emissor: inst ? `FAPESP · ${inst}` : 'FAPESP (Fundação de Amparo à Pesquisa do Estado de São Paulo)',
      titulo,
      resumo_objeto: resumo || `Oportunidade vigente de pesquisa e inovação financiada pela FAPESP${city ? ` em ${city}/SP` : ''}.`,
      elegibilidade: `Universidades, ICTs e pesquisadores vinculados a projetos FAPESP${city ? ` (${city}/SP)` : ' (São Paulo)'}`,
      valor_total_ou_teto: 'Conforme tabela vigente FAPESP',
      prazo_submissao: `${deadlineBr} até às 23:59`,
      fonte_recurso: 'FAP Estadual — FAPESP (Fomento à Pesquisa e Inovação)',
      url_oficial: fullUrl,
    };

    candidates.push({
      item,
      searchBlob: normalizeText(`${titulo} ${inst} ${city} sao paulo sp sudeste fapesp pesquisa inovacao ciencia ${resumo}`),
      sourceKind: 'fapesp',
      isChamamentoPublico: true,
      year: Number(deadlineIso.slice(0, 4)) || 2026,
    });
  }

  return candidates;
}

export async function searchOfficialBrazilianPortals(params: {
  areaTematica: string;
  tipoEnte: string;
  estadoRegiao: string;
  fonteFoco: string;
  dataConsulta: string;
}): Promise<SearchEditaisResponse> {
  const { areaTematica, tipoEnte, estadoRegiao, fonteFoco, dataConsulta } = params;

  const [tedRes, fafRes, espRes, fapespRes] = await Promise.allSettled([
    fetchTransferegovTed(dataConsulta),
    fetchTransferegovFundoAFundo(dataConsulta),
    fetchTransferegovEspeciais(dataConsulta),
    fetchFapespOportunidades(dataConsulta),
  ]);

  const allCandidates: CandidateEdital[] = [
    ...(tedRes.status === 'fulfilled' ? tedRes.value : []),
    ...(fafRes.status === 'fulfilled' ? fafRes.value : []),
    ...(espRes.status === 'fulfilled' ? espRes.value : []),
    ...(fapespRes.status === 'fulfilled' ? fapespRes.value : []),
  ];

  const groundingSources: GroundingSource[] = [
    {
      title: 'API Oficial Transferegov — Programas TED Disponibilizados',
      uri: 'https://www.gov.br/transferegov/pt-br',
    },
    {
      title: 'Portal Transferegov — Termos de Execução Descentralizada',
      uri: 'https://ted.transferegov.sistema.gov.br/',
    },
    {
      title: 'Portal Oficial FAPESP — Oportunidades com Inscrições Abertas',
      uri: 'https://fapesp.br/oportunidades/',
    },
  ];

  const expandedTokens = expandSearchTokens(areaTematica);
  const directTokens = normalizeText(areaTematica)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  const normEnte = normalizeText(tipoEnte);
  const normEstado = normalizeText(estadoRegiao);
  const normFonte = normalizeText(fonteFoco);

  const wantsFapsOnly = normFonte.includes('faps');
  const wantsBndesFinep = normFonte.includes('bndes') || normFonte.includes('finep');
  const wantsTransferegov = normFonte.includes('transferegov') || normFonte.includes('ministerios');
  const wantsIcts = normEnte.includes('universidade') || normEnte.includes('ict');
  const isRegionalSp = normEstado.includes('sao paulo') || normEstado.includes('sudeste');
  const isNational = normEstado.includes('todo o brasil') || normEstado.includes('nacional') || !normEstado;

  const stateTokens = isNational
    ? []
    : normEstado
        .replace(/regiao/g, '')
        .split(' ')
        .filter((t) => t.length >= 2);

  const scored = allCandidates
    .map((candidate) => {
      let score = 0;

      // Source focus alignment
      if (wantsFapsOnly) {
        if (candidate.sourceKind === 'fapesp') score += 40;
        else score -= 35;
      } else if (wantsBndesFinep) {
        if (candidate.sourceKind === 'fndct') score += 40;
        else if (candidate.sourceKind === 'fapesp') score += 12;
        else score -= 10;
      } else if (wantsTransferegov) {
        if (candidate.sourceKind === 'transferegov') score += 25;
        else if (candidate.sourceKind === 'fndct') score += 10;
        else score -= 25;
      } else {
        if (candidate.sourceKind === 'transferegov') score += 10;
        if (candidate.sourceKind === 'fndct') score += 12;
        if (candidate.sourceKind === 'fapesp') score += wantsIcts || isRegionalSp ? 18 : 6;
      }

      if (candidate.isChamamentoPublico) score += 8;
      if (candidate.year >= 2026) score += 6;

      // Direct thematic matches carry highest weight
      let themeHits = 0;
      for (const token of directTokens) {
        if (candidate.searchBlob.includes(token)) {
          score += 24;
          themeHits++;
        }
      }
      for (const syn of expandedTokens) {
        if (!directTokens.includes(syn) && candidate.searchBlob.includes(syn)) {
          score += 9;
          themeHits++;
        }
      }

      // Territorial match boost
      for (const st of stateTokens) {
        if (st.length >= 3 && candidate.searchBlob.includes(st)) {
          score += 14;
        }
      }

      // If user explicitly chose a non-SP state, lower SP-only FAPESP priority
      if (!isNational && !isRegionalSp && candidate.sourceKind === 'fapesp') {
        score -= 22;
      }

      return { candidate, score, themeHits };
    })
    .filter(({ candidate, score, themeHits }) => {
      if (wantsFapsOnly && candidate.sourceKind !== 'fapesp') return false;
      if (directTokens.length > 0 && themeHits === 0 && score < 25) return false;
      return score > 0;
    });

  scored.sort((a, b) => b.score - a.score);

  // Deduplicate similar titles / avoid flooding from a single identical program line
  const selected: EditalItem[] = [];
  const seenTitleNorm = new Set<string>();
  const perOrgCount = new Map<string, number>();

  for (const entry of scored) {
    const { item } = entry.candidate;
    const titleKey = normalizeText(item.titulo).slice(0, 48);
    if (seenTitleNorm.has(titleKey)) continue;

    const orgKey = normalizeText(item.orgao_emissor).slice(0, 32);
    const currentOrgCount = perOrgCount.get(orgKey) ?? 0;
    if (currentOrgCount >= 3 && selected.length >= 4) continue;

    seenTitleNorm.add(titleKey);
    perOrgCount.set(orgKey, currentOrgCount + 1);
    selected.push(item);

    if (selected.length >= 12) break;
  }

  // If thematic filter was very narrow and returned 0 strict matches, surface top open national programs with transparent notice
  let aviso =
    'Consulta realizada diretamente nas APIs oficiais do Governo Federal (Transferegov) e Portal FAPESP com prazos vigentes verificados em tempo real.';

  if (selected.length === 0 && allCandidates.length > 0 && directTokens.length === 0) {
    const fallback = allCandidates.slice(0, 10).map((c) => c.item);
    selected.push(...fallback);
  } else if (selected.length === 0) {
    aviso =
      'Nenhuma chamada aberta com prazo vigente foi localizada nas APIs oficiais (Transferegov e FAPESP) para a combinação exata de filtros informada. Tente termos mais amplos na área temática.';
  }

  const searchQueries = [
    'api.transferegov.gestao.gov.br/ted/programa (DISPONIBILIZADO, prazo vigente)',
    'api.transferegov.gestao.gov.br/fundoafundo/programa (prazo vigente)',
    'fapesp.br/oportunidades/ (inscrições abertas)',
  ];

  return {
    resultado: {
      total_encontrados: selected.length,
      data_consulta: dataConsulta,
      editais: selected,
    },
    groundingSources,
    searchQueries,
    aviso,
  };
}

function isAllowedOfficialFetchUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.username || parsed.password) return null;
    const host = parsed.hostname.toLowerCase();
    const allowedSuffixes = [
      '.gov.br',
      'gov.br',
      'fapesp.br',
      '.fapesp.br',
      'cnpq.br',
      '.cnpq.br',
      'iadb.org',
      '.iadb.org',
      'worldbank.org',
      '.worldbank.org',
      'caf.com',
      '.caf.com',
      'undp.org',
      '.undp.org',
    ];
    const isAllowed =
      allowedSuffixes.some((suffix) =>
        suffix.startsWith('.') ? host.endsWith(suffix) : host === suffix,
      ) || /^([a-z0-9-]+\.)?fap[a-z]{2,6}\.br$/.test(host);

    if (!isAllowed) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function fetchAllowedOfficialUrl(initialUrl: string): Promise<Response> {
  let currentUrl = isAllowedOfficialFetchUrl(initialUrl);
  if (!currentUrl) {
    throw new Error('UNSUPPORTED_OFFICIAL_HOST');
  }

  for (let hop = 0; hop <= 3; hop++) {
    const response = await fetch(currentUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/html;q=0.9' },
      signal: AbortSignal.timeout(9000),
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return response;
      const resolved = new URL(location, currentUrl).toString();
      const validatedNext = isAllowedOfficialFetchUrl(resolved);
      if (!validatedNext) {
        throw new Error('UNSUPPORTED_OFFICIAL_HOST');
      }
      currentUrl = validatedNext;
      continue;
    }

    return response;
  }

  throw new Error('TOO_MANY_REDIRECTS');
}

export async function analyzeOfficialUrlDirectly(safeUrl: string): Promise<EditalDeepAnalysis> {
  const response = await fetchAllowedOfficialUrl(safeUrl);

  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const body = (await response.text()).slice(0, 120000);

  if (contentType.includes('application/json') || body.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(body);
      const record = (Array.isArray(parsed) ? parsed[0] : parsed) as Record<string, unknown> | undefined;
      if (record && typeof record === 'object') {
        const objetivo = cleanSnippet(
          String(record.tx_objetivo_programa || record.objetivo_programa || ''),
          320,
        );
        const descricao = cleanSnippet(
          String(record.tx_descricao_programa || record.descricao_programa || ''),
          600,
        );
        const inicio = formatIsoToBrDate(
          String(
            record.dt_recebimento_plano_chamamento_inicio ||
              record.dt_recebimento_plano_beneficiario_inicio ||
              record.data_inicio_ciencia_programa ||
              '',
          ),
        );
        const fim = formatIsoToBrDate(
          String(
            record.dt_recebimento_plano_chamamento_fim ||
              record.dt_recebimento_plano_beneficiario_fim ||
              record.data_fim_recebimento_planos_acao_beneficiarios_voluntarios ||
              record.data_fim_recebimento_planos_acao_beneficiarios_especificos ||
              record.data_fim_ciencia_programa ||
              '',
          ),
        );

        const cronograma: string[] = [];
        if (inicio) cronograma.push(`Início de recebimento de planos/propostas: ${inicio}`);
        if (fim) cronograma.push(`Prazo final vigente de submissão: ${fim}`);

        const docs: string[] = [
          'Plano de Trabalho / Plano de Ação cadastrado no portal Transferegov',
          'Regularidade cadastral e habilitação do ente/unidade no Transferegov',
        ];
        if (record.permite_transferencia_sem_fundo_programa === false) {
          docs.push('Comprovação de fundo público constituído e ativo para recebimento fundo a fundo');
        }

        const etapas: string[] = [
          'Acessar o portal oficial Transferegov com credenciais Gov.br do gestor responsável.',
          `Localizar o programa pelo código ${String(record.tx_codigo_programa || record.codigo_programa || 'oficial')}.`,
          'Preencher e submeter o Plano de Trabalho/Ação dentro do prazo vigente com as metas e justificativas técnicas.',
        ];

        const atencao: string[] = [];
        if (objetivo) atencao.push(`Objeto oficial: ${objetivo}`);
        if (descricao && descricao !== objetivo) atencao.push(`Detalhamento técnico: ${descricao.slice(0, 260)}`);

        return {
          contrapartida:
            'Conforme regras da modalidade no Transferegov e Lei de Diretrizes Orçamentárias (LDO) vigente.',
          documentos_exigidos: docs,
          cronograma_chaves: cronograma.length > 0 ? cronograma : ['Consulte o cronograma atualizado no portal Transferegov.'],
          etapas_submissao: etapas,
          pontos_atencao: atencao.length > 0 ? atencao : ['Verifique a situação de adimplência no CAUC antes da submissão.'],
          fontes_verificadas: [{ title: 'Registro Oficial Transferegov API', uri: safeUrl }],
        };
      }
    } catch {
      // Fall through to HTML parsing
    }
  }

  // Generic safe HTML plain-text extraction for official pages (e.g., FAPESP, gov.br)
  const plain = decodeHtmlEntities(
    body
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, '\n'),
  )
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 18);

  const pickByRegex = (regex: RegExp, limit: number): string[] => {
    const out: string[] = [];
    for (const line of plain) {
      if (regex.test(line) && !out.includes(line)) {
        out.push(line.slice(0, 260));
        if (out.length >= limit) break;
      }
    }
    return out;
  };

  const contrapartidaLine = pickByRegex(/contrapartida|financiamento|bolsa|valor|orçamento/i, 1)[0];
  const docs = pickByRegex(/document|currículo|súmula|projeto|certidão|comprov|carta|anexo/i, 5);
  const cronograma = pickByRegex(/\d{2}\/\d{2}\/\d{4}|inscriç|prazo|submissão|cronograma|resultado/i, 5);
  const etapas = pickByRegex(/inscriç|enviar|submeter|e-mail|sistema|sage|plataforma|como se inscrever/i, 4);
  const atencao = pickByRegex(/requisito|elegív|obrigatór|critério|seleção|área/i, 4);

  return {
    contrapartida:
      contrapartidaLine || 'Não especificado de forma isolada na página — verifique a íntegra do edital oficial.',
    documentos_exigidos:
      docs.length > 0 ? docs : ['Consulte a lista completa de anexos e exigências na página oficial do edital.'],
    cronograma_chaves:
      cronograma.length > 0 ? cronograma : ['Verifique as datas atualizadas diretamente na publicação oficial.'],
    etapas_submissao:
      etapas.length > 0 ? etapas : ['Acesse o link oficial do edital e siga as instruções de envio indicadas pelo órgão emissor.'],
    pontos_atencao:
      atencao.length > 0 ? atencao : ['Confirme os critérios de elegibilidade do proponente antes de iniciar a submissão.'],
    fontes_verificadas: [{ title: 'Página Oficial do Edital', uri: safeUrl }],
  };
}
