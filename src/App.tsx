import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Menu,
  Table2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EditalInspector } from './components/EditalInspector';
import { EditaisTable } from './components/EditaisTable';
import { HistoryView } from './components/HistoryView';
import { JsonOutputView } from './components/JsonOutputView';
import { SavedView } from './components/SavedView';
import { SearchForm } from './components/SearchForm';
import { Sidebar, type ActiveSection } from './components/Sidebar';
import type {
  EditalItem,
  EditaisJsonPayload,
  GroundingSource,
  SavedEdital,
  SearchEditaisRequest,
  SearchEditaisResponse,
  SearchHistoryEntry,
  TrackingStatus,
} from './types/edital';
import {
  ESTADOS_E_REGIOES,
  FONTES_FOCO,
  TIPOS_ENTE_PUBLICO,
} from './utils/constants';
import {
  downloadCsvFile,
  downloadJsonFile,
  formatEditaisJson,
} from './utils/export';
import { classifyDeadline, extractDomainLabel, sanitizeHttpUrl } from './utils/url';

const STORAGE_SAVED_KEY = 'radar_capta_saved_v1';
const STORAGE_HISTORY_KEY = 'radar_capta_history_v1';

const DEFAULT_PARAMS: SearchEditaisRequest = {
  areaTematica: '',
  tipoEnte: TIPOS_ENTE_PUBLICO[0],
  estadoRegiao: ESTADOS_E_REGIOES[0].options[0],
  fonteFoco: FONTES_FOCO[0],
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function getTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const MONITORED_SOURCES = [
  {
    name: 'Transferegov e Ministérios',
    scope: 'Transferências voluntárias, Novo PAC e programas setoriais da União',
    preset: {
      areaTematica: 'Infraestrutura, Saúde e Educação',
      tipoEnte: 'Prefeituras / Municípios',
      estadoRegiao: 'Todo o Brasil (Nacional)',
      fonteFoco: 'Transferegov e Ministérios Federais',
    },
  },
  {
    name: 'BNDES e FINEP',
    scope: 'Crédito estruturado, inovação tecnológica, transição energética e saneamento',
    preset: {
      areaTematica: 'Inovação, Mobilidade e Transição Energética',
      tipoEnte: 'Todos os Entes Públicos (Municípios, Estados e Consórcios)',
      estadoRegiao: 'Todo o Brasil (Nacional)',
      fonteFoco: 'BNDES, FINEP e Bancos Públicos',
    },
  },
  {
    name: 'FAPs Estaduais',
    scope: 'Chamadas de pesquisa aplicada, políticas públicas e governos estaduais',
    preset: {
      areaTematica: 'Pesquisa Aplicada e Políticas Públicas',
      tipoEnte: 'Universidades Públicas e ICTs',
      estadoRegiao: 'Todo o Brasil (Nacional)',
      fonteFoco: 'FAPs (Fundações Estaduais de Amparo à Pesquisa)',
    },
  },
  {
    name: 'Organismos Internacionais',
    scope: 'Cooperação técnica e financiamento climático (BID, CAF, PNUD, Banco Mundial)',
    preset: {
      areaTematica: 'Adaptação Climática, Cidades Sustentáveis e Governança',
      tipoEnte: 'Consórcios Públicos Intermunicipais',
      estadoRegiao: 'Todo o Brasil (Nacional)',
      fonteFoco: 'Organismos Internacionais no Brasil (BID, CAF, PNUD, Banco Mundial)',
    },
  },
];

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('rastreador');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [formValues, setFormValues] = useState<SearchEditaisRequest>(DEFAULT_PARAMS);
  const [viewMode, setViewMode] = useState<'tabela' | 'json'>('tabela');

  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | undefined>(undefined);

  const [resultado, setResultado] = useState<EditaisJsonPayload>({
    total_encontrados: 0,
    data_consulta: getTodayIso(),
    editais: [],
  });
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);
  const [searchQueries, setSearchQueries] = useState<string[]>([]);

  const [selectedEdital, setSelectedEdital] = useState<EditalItem | null>(null);
  const [copiedQuickJson, setCopiedQuickJson] = useState(false);

  const [savedEditais, setSavedEditais] = useState<SavedEdital[]>(() =>
    readStorage<SavedEdital[]>(STORAGE_SAVED_KEY, []),
  );
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>(() =>
    readStorage<SearchHistoryEntry[]>(STORAGE_HISTORY_KEY, []),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_SAVED_KEY, JSON.stringify(savedEditais));
    } catch {
      // Ignore storage quota errors
    }
  }, [savedEditais]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(searchHistory));
    } catch {
      // Ignore storage quota errors
    }
  }, [searchHistory]);

  const savedIds = useMemo(
    () => new Set(savedEditais.map((item) => item.id)),
    [savedEditais],
  );

  const urgentCount = useMemo(() => {
    return resultado.editais.filter(
      (item) => classifyDeadline(item.prazo_submissao, resultado.data_consulta).urgency === 'urgent',
    ).length;
  }, [resultado]);

  const executeSearch = async (params: SearchEditaisRequest) => {
    setActiveSection('rastreador');
    setFormValues(params);
    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);
    setAviso(undefined);
    setSelectedEdital(null);

    try {
      const response = await fetch('/api/search-editais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error || 'Não foi possível concluir a busca em tempo real.',
        );
      }

      const payload = data as SearchEditaisResponse;
      setResultado(payload.resultado);
      setGroundingSources(payload.groundingSources ?? []);
      setSearchQueries(payload.searchQueries ?? []);
      setAviso(payload.aviso);

      const historyEntry: SearchHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        params,
        totalEncontrados: payload.resultado.total_encontrados,
        dataConsulta: payload.resultado.data_consulta,
      };
      setSearchHistory((prev) => [historyEntry, ...prev].slice(0, 20));
    } catch (err) {
      setSearchError(
        err instanceof Error
          ? err.message
          : 'Erro inesperado ao consultar os editais vigentes.',
      );
      setResultado({
        total_encontrados: 0,
        data_consulta: getTodayIso(),
        editais: [],
      });
      setGroundingSources([]);
      setSearchQueries([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleToggleSave = (edital: EditalItem) => {
    setSavedEditais((prev) => {
      const exists = prev.some((item) => item.id === edital.id);
      if (exists) {
        return prev.filter((item) => item.id !== edital.id);
      }
      const next: SavedEdital = {
        ...edital,
        savedAt: new Date().toISOString(),
        status: 'em_analise',
        notas: '',
      };
      return [next, ...prev];
    });
  };

  const handleUpdateSavedMeta = (
    id: string,
    status: TrackingStatus,
    notas: string,
  ) => {
    setSavedEditais((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status, notas } : item)),
    );
  };

  const handleRemoveSaved = (id: string) => {
    setSavedEditais((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(formatEditaisJson(resultado));
      setCopiedQuickJson(true);
      setTimeout(() => setCopiedQuickJson(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const breadcrumbLabel =
    activeSection === 'rastreador'
      ? 'Rastreador de Editais'
      : activeSection === 'salvos'
        ? 'Acompanhamento'
        : 'Histórico de Consultas';

  const selectedSavedRecord = selectedEdital
    ? savedEditais.find((s) => s.id === selectedEdital.id)
    : undefined;

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-[#0F172A]">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        savedCount={savedEditais.length}
        historyCount={searchHistory.length}
        onApplyPreset={executeSearch}
        isSearching={isSearching}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu lateral"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md"
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav aria-label="Localização atual" className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-medium text-slate-500 whitespace-nowrap shrink-0 hidden sm:inline">
                Radar Capta
              </span>
              <span aria-hidden="true" className="text-slate-300 hidden sm:inline">
                /
              </span>
              <span className="font-semibold text-slate-900 truncate">
                {breadcrumbLabel}
              </span>
            </nav>
          </div>

          <div className="flex items-center shrink-0">
            {hasSearched && resultado.editais.length > 0 && activeSection === 'rastreador' ? (
              <button
                type="button"
                onClick={() => downloadJsonFile(resultado)}
                className="inline-flex items-center gap-2 h-9 px-4 text-xs font-medium text-white bg-[#0F5132] hover:bg-[#0B3F27] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span>Exportar JSON</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isSearching}
                onClick={() => executeSearch(formValues)}
                className="inline-flex items-center gap-2 h-9 px-4 text-xs font-medium text-white bg-[#0F5132] hover:bg-[#0B3F27] rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
              >
                <span>{isSearching ? 'Buscando...' : 'Nova Consulta'}</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
          {activeSection === 'rastreador' && (
            <>
              <SearchForm
                values={formValues}
                onChange={setFormValues}
                onSubmit={executeSearch}
                onReset={() => setFormValues(DEFAULT_PARAMS)}
                isLoading={isSearching}
              />

              {hasSearched && !isSearching && !searchError && (
                <section
                  aria-label="Resumo da consulta"
                  className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
                >
                  <div className="px-5 py-4">
                    <div className="text-xs font-medium text-slate-500">Editais vigentes</div>
                    <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                      {resultado.total_encontrados}
                    </div>
                  </div>
                  <div className="px-5 py-4">
                    <div className="text-xs font-medium text-slate-500">Data da consulta</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums leading-8">
                      {resultado.data_consulta}
                    </div>
                  </div>
                  <div className="px-5 py-4">
                    <div className="text-xs font-medium text-slate-500">Prazos em até 15 dias</div>
                    <div className="mt-1 font-mono text-2xl font-semibold text-[#B45309] tabular-nums">
                      {urgentCount}
                    </div>
                  </div>
                  <div className="px-5 py-4">
                    <div className="text-xs font-medium text-slate-500">Fontes verificadas</div>
                    <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                      {groundingSources.length}
                    </div>
                  </div>
                </section>
              )}

              {hasSearched && !isSearching && !searchError && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div
                    role="tablist"
                    aria-label="Formato de visualização dos resultados"
                    className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={viewMode === 'tabela'}
                      onClick={() => setViewMode('tabela')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        viewMode === 'tabela'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Table2 className="h-3.5 w-3.5" />
                      <span>Tabela estruturada</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={viewMode === 'json'}
                      onClick={() => setViewMode('json')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        viewMode === 'json'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Code2 className="h-3.5 w-3.5" />
                      <span>JSON estrito</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedQuickJson ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#15803D]" />
                          <span>JSON copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar JSON</span>
                        </>
                      )}
                    </button>
                    {resultado.editais.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          downloadCsvFile(resultado.editais, resultado.data_consulta)
                        }
                        className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Exportar CSV</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {viewMode === 'tabela' || isSearching || searchError || !hasSearched ? (
                <>
                  <EditaisTable
                    editais={resultado.editais}
                    dataConsulta={resultado.data_consulta}
                    isLoading={isSearching}
                    hasSearched={hasSearched}
                    error={searchError}
                    aviso={aviso}
                    savedIds={savedIds}
                    selectedId={selectedEdital?.id ?? null}
                    onSelectEdital={setSelectedEdital}
                    onToggleSave={handleToggleSave}
                    onRetrySearch={() => executeSearch(formValues)}
                  />

                  {!hasSearched && !isSearching && (
                    <section
                      aria-label="Portais e órgãos monitorados"
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                    >
                      <div className="px-6 py-4 border-b border-slate-200 flex items-baseline justify-between gap-4">
                        <h2 className="font-display text-base font-semibold text-slate-900">
                          Ecossistema de captação monitorado
                        </h2>
                        <span className="text-xs text-slate-500">
                          Clique em uma frente para iniciar rastreamento imediato
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                        <div className="divide-y divide-slate-200">
                          {MONITORED_SOURCES.slice(0, 2).map((source) => (
                            <button
                              key={source.name}
                              type="button"
                              onClick={() => executeSearch(source.preset)}
                              className="w-full text-left px-6 py-5 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <div className="text-sm font-semibold text-slate-900">
                                {source.name}
                              </div>
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                {source.scope}
                              </p>
                            </button>
                          ))}
                        </div>
                        <div className="divide-y divide-slate-200">
                          {MONITORED_SOURCES.slice(2, 4).map((source) => (
                            <button
                              key={source.name}
                              type="button"
                              onClick={() => executeSearch(source.preset)}
                              className="w-full text-left px-6 py-5 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <div className="text-sm font-semibold text-slate-900">
                                {source.name}
                              </div>
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                {source.scope}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}

                  {hasSearched && !isSearching && groundingSources.length > 0 && (
                    <section
                      aria-label="Fontes verificadas na busca"
                      className="bg-white border border-slate-200 rounded-xl px-5 py-4"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2.5">
                        <h3 className="text-xs font-semibold text-slate-700">
                          Fontes oficiais consultadas nesta sessão (Google Search)
                        </h3>
                        <span className="text-xs font-mono tabular-nums text-slate-500">
                          {groundingSources.length} link(s) verificado(s)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                        {groundingSources.slice(0, 12).map((src) => {
                          const safeUri = sanitizeHttpUrl(src.uri);
                          if (!safeUri) return null;
                          return (
                            <a
                              key={safeUri}
                              href={safeUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-slate-600 hover:text-[#0F5132] transition-colors"
                            >
                              <span className="truncate max-w-[220px]">
                                {src.title || extractDomainLabel(safeUri)}
                              </span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <JsonOutputView
                  payload={resultado}
                  groundingSources={groundingSources}
                  searchQueries={searchQueries}
                />
              )}
            </>
          )}

          {activeSection === 'salvos' && (
            <SavedView
              savedEditais={savedEditais}
              onSelectEdital={setSelectedEdital}
              onRemoveSaved={handleRemoveSaved}
              onUpdateSavedMeta={handleUpdateSavedMeta}
              onGoToSearch={() => setActiveSection('rastreador')}
            />
          )}

          {activeSection === 'historico' && (
            <HistoryView
              history={searchHistory}
              onReplay={executeSearch}
              onDeleteEntry={(id) =>
                setSearchHistory((prev) => prev.filter((item) => item.id !== id))
              }
              onClearHistory={() => setSearchHistory([])}
              onGoToSearch={() => setActiveSection('rastreador')}
            />
          )}
        </main>
      </div>

      <EditalInspector
        edital={selectedEdital}
        dataConsulta={resultado.data_consulta}
        savedRecord={selectedSavedRecord}
        onClose={() => setSelectedEdital(null)}
        onToggleSave={handleToggleSave}
        onUpdateSavedMeta={handleUpdateSavedMeta}
      />
    </div>
  );
}
