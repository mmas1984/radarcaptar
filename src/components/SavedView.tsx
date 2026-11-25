import { Download, ExternalLink, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { EditalItem, SavedEdital, TrackingStatus } from '../types/edital';
import { TRACKING_STATUS_LABELS } from '../utils/constants';
import { downloadCsvFile, downloadJsonFile } from '../utils/export';
import { sanitizeHttpUrl } from '../utils/url';

interface SavedViewProps {
  savedEditais: SavedEdital[];
  onSelectEdital: (edital: EditalItem) => void;
  onRemoveSaved: (id: string) => void;
  onUpdateSavedMeta: (id: string, status: TrackingStatus, notas: string) => void;
  onGoToSearch: () => void;
}

type StatusFilter = 'todos' | TrackingStatus;

export function SavedView({
  savedEditais,
  onSelectEdital,
  onRemoveSaved,
  onUpdateSavedMeta,
  onGoToSearch,
}: SavedViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');

  const filtered = useMemo(() => {
    if (statusFilter === 'todos') return savedEditais;
    return savedEditais.filter((item) => item.status === statusFilter);
  }, [savedEditais, statusFilter]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const handleExportJson = () => {
    const cleanItems: EditalItem[] = filtered.map(
      ({ savedAt: _s, status: _st, notas: _n, ...edital }) => edital,
    );
    downloadJsonFile(
      {
        total_encontrados: cleanItems.length,
        data_consulta: todayIso,
        editais: cleanItems,
      },
      `editais-salvos-${todayIso}.json`,
    );
  };

  if (savedEditais.length === 0) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl px-6 py-14 text-center">
        <h2 className="font-display text-xl font-semibold text-slate-900">
          Nenhum edital salvo em acompanhamento
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto mt-2">
          Salve oportunidades diretamente na tabela de resultados para acompanhar status de elaboração, prazos e anotações da equipe técnica.
        </p>
        <button
          type="button"
          onClick={onGoToSearch}
          className="mt-5 px-4 py-2.5 text-sm font-medium text-white bg-[#0F5132] hover:bg-[#0B3F27] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
        >
          Ir para o Rastreador
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Acompanhamento de Captação
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Editais salvos localmente neste navegador com controle de situação e notas técnicas.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Baixar JSON</span>
          </button>
          <button
            type="button"
            onClick={() => downloadCsvFile(filtered, todayIso)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto max-w-full">
          {(['todos', 'em_analise', 'preparando', 'submetido', 'descartado'] as StatusFilter[]).map(
            (key) => {
              const active = statusFilter === key;
              const label = key === 'todos' ? 'Todos' : TRACKING_STATUS_LABELS[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              );
            },
          )}
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-500">
          {filtered.length} edital(is)
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-600">
            Nenhum edital salvo nesta situação.
          </div>
        ) : (
          filtered.map((item) => {
            const safeUrl = sanitizeHttpUrl(item.url_oficial);
            return (
              <div
                key={item.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => onSelectEdital(item)}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{item.orgao_emissor}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{item.prazo_submissao}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{item.valor_total_ou_teto}</span>
                  </div>
                  <div className="font-medium text-slate-900 mt-1 hover:text-[#0F5132] transition-colors">
                    {item.titulo}
                  </div>
                  {item.notas && (
                    <p className="text-xs text-slate-600 mt-1.5 line-clamp-1">
                      Nota: {item.notas}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <select
                    aria-label={`Situação do edital ${item.titulo}`}
                    value={item.status}
                    onChange={(e) =>
                      onUpdateSavedMeta(
                        item.id,
                        e.target.value as TrackingStatus,
                        item.notas,
                      )
                    }
                    className="h-9 px-2.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:border-[#0F5132] focus:outline-none"
                  >
                    {(Object.keys(TRACKING_STATUS_LABELS) as TrackingStatus[]).map((statusKey) => (
                      <option key={statusKey} value={statusKey}>
                        {TRACKING_STATUS_LABELS[statusKey]}
                      </option>
                    ))}
                  </select>

                  {safeUrl && (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Abrir página oficial"
                      className="p-2 text-slate-500 hover:text-[#0F5132] hover:bg-slate-100 rounded-md transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => onRemoveSaved(item.id)}
                    aria-label="Remover dos salvos"
                    className="p-2 text-slate-400 hover:text-[#B91C1C] hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
