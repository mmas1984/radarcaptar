import type { SearchEditaisRequest, TrackingStatus } from '../types/edital';

export const TIPOS_ENTE_PUBLICO: string[] = [
  'Todos os Entes Públicos (Municípios, Estados e Consórcios)',
  'Prefeituras / Municípios',
  'Estados / Governos Estaduais',
  'Consórcios Públicos Intermunicipais',
  'Autarquias e Fundações Públicas',
  'Universidades Públicas e ICTs',
];

export const ESTADOS_E_REGIOES: { group: string; options: string[] }[] = [
  {
    group: 'Abrangência Nacional',
    options: ['Todo o Brasil (Nacional)'],
  },
  {
    group: 'Macrorregiões',
    options: [
      'Região Norte',
      'Região Nordeste',
      'Região Centro-Oeste',
      'Região Sudeste',
      'Região Sul',
      'Amazônia Legal',
      'Semiárido Brasileiro',
    ],
  },
  {
    group: 'Unidades da Federação',
    options: [
      'Acre (AC)',
      'Alagoas (AL)',
      'Amapá (AP)',
      'Amazonas (AM)',
      'Bahia (BA)',
      'Ceará (CE)',
      'Distrito Federal (DF)',
      'Espírito Santo (ES)',
      'Goiás (GO)',
      'Maranhão (MA)',
      'Mato Grosso (MT)',
      'Mato Grosso do Sul (MS)',
      'Minas Gerais (MG)',
      'Pará (PA)',
      'Paraíba (PB)',
      'Paraná (PR)',
      'Pernambuco (PE)',
      'Piauí (PI)',
      'Rio de Janeiro (RJ)',
      'Rio Grande do Norte (RN)',
      'Rio Grande do Sul (RS)',
      'Rondônia (RO)',
      'Roraima (RR)',
      'Santa Catarina (SC)',
      'São Paulo (SP)',
      'Sergipe (SE)',
      'Tocantins (TO)',
    ],
  },
];

export const FONTES_FOCO: string[] = [
  'Todas as fontes oficiais',
  'Transferegov e Ministérios Federais',
  'BNDES, FINEP e Bancos Públicos',
  'FAPs (Fundações Estaduais de Amparo à Pesquisa)',
  'Organismos Internacionais no Brasil (BID, CAF, PNUD, Banco Mundial)',
];

export const AREAS_TEMATICAS_SUGERIDAS: string[] = [
  'Infraestrutura Urbana e Mobilidade',
  'Saneamento Básico e Resíduos Sólidos',
  'Saúde Pública e Atenção Primária',
  'Educação Básica e Conectividade Escolar',
  'Meio Ambiente, Clima e Transição Energética',
  'Inovação, Ciência e Cidades Inteligentes',
  'Cultura, Patrimônio e Economia Criativa',
  'Agricultura Familiar e Desenvolvimento Rural',
  'Segurança Pública e Defesa Civil',
  'Assistência Social e Habitação',
];

export interface StrategicPreset {
  label: string;
  subtitle: string;
  params: SearchEditaisRequest;
}

export const STRATEGIC_PRESETS: StrategicPreset[] = [
  {
    label: 'Infraestrutura e PAC',
    subtitle: 'Prefeituras · Nacional',
    params: {
      areaTematica: 'Infraestrutura Urbana, Saneamento e Mobilidade',
      tipoEnte: 'Prefeituras / Municípios',
      estadoRegiao: 'Todo o Brasil (Nacional)',
      fonteFoco: 'Transferegov e Ministérios Federais',
    },
  },
  {
    label: 'Inovação e FINEP',
    subtitle: 'Estados e ICTs · Nacional',
    params: {
      areaTematica: 'Ciência, Tecnologia, Inovação e Cidades Inteligentes',
      tipoEnte: 'Universidades Públicas e ICTs',
      estadoRegiao: 'Todo o Brasil (Nacional)',
      fonteFoco: 'BNDES, FINEP e Bancos Públicos',
    },
  },
  {
    label: 'Clima e Sustentabilidade',
    subtitle: 'Consórcios · Nacional',
    params: {
      areaTematica: 'Meio Ambiente, Adaptação Climática e Resíduos Sólidos',
      tipoEnte: 'Consórcios Públicos Intermunicipais',
      estadoRegiao: 'Todo o Brasil (Nacional)',
      fonteFoco: 'Todas as fontes oficiais',
    },
  },
  {
    label: 'Saúde e Educação',
    subtitle: 'Municípios · Nacional',
    params: {
      areaTematica: 'Saúde Pública e Educação Básica',
      tipoEnte: 'Prefeituras / Municípios',
      estadoRegiao: 'Todo o Brasil (Nacional)',
      fonteFoco: 'Transferegov e Ministérios Federais',
    },
  },
];

export const TRACKING_STATUS_LABELS: Record<TrackingStatus, string> = {
  em_analise: 'Em análise',
  preparando: 'Preparando proposta',
  submetido: 'Submetido',
  descartado: 'Descartado',
};
