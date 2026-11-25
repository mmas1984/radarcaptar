export interface EditalItem {
  id: string;
  orgao_emissor: string;
  titulo: string;
  resumo_objeto: string;
  elegibilidade: string;
  valor_total_ou_teto: string;
  prazo_submissao: string;
  fonte_recurso: string;
  url_oficial: string;
}

export interface EditaisJsonPayload {
  total_encontrados: number;
  data_consulta: string;
  editais: EditalItem[];
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface SearchEditaisRequest {
  areaTematica: string;
  tipoEnte: string;
  estadoRegiao: string;
  fonteFoco?: string;
}

export interface SearchEditaisResponse {
  resultado: EditaisJsonPayload;
  groundingSources: GroundingSource[];
  searchQueries: string[];
  aviso?: string;
}

export type TrackingStatus = 'em_analise' | 'preparando' | 'submetido' | 'descartado';

export interface SavedEdital extends EditalItem {
  savedAt: string;
  status: TrackingStatus;
  notas: string;
}

export interface SearchHistoryEntry {
  id: string;
  timestamp: string;
  params: SearchEditaisRequest;
  totalEncontrados: number;
  dataConsulta: string;
}

export interface EditalDeepAnalysis {
  contrapartida: string;
  documentos_exigidos: string[];
  cronograma_chaves: string[];
  etapas_submissao: string[];
  pontos_atencao: string[];
  fontes_verificadas: GroundingSource[];
}
