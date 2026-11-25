import { Play, Trash2 } from 'lucide-react';
import type { SearchEditaisRequest, SearchHistoryEntry } from '../types/edital';

interface HistoryViewProps {
  history: SearchHistoryEntry[];
  onReplay: (params: SearchEditaisRequest) => void;
  onDeleteEntry: (id: string) => void;
  onClearHistory: () => void;
  onGoToSearch: () => void;
}

export function HistoryView({
  history,
  onReplay,
  onDeleteEntry,
  onClearHistory,
  onGoToSearch,
}: HistoryViewProps) {
  if (history.length === 0) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl px-6 py-14 text-center">
        <h2 className="font-display text-xl font-semibold text-slate-900">
          Nenhuma consulta registrada
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto mt-2">
          Cada rastreamento realizado é salvo aqui para que você possa reexecutar pesquisas recorrentes em um clique.
        </p>
        <button
          type="button"
          onClick={onGoToSearch}
          className="mt-5 px-4 py-2.5 text-sm font-medium text-white bg-[#0F5132] hover:bg-[#0B3F27] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
        >
          Fazer primeira consulta
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Histórico de Consultas
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Reexecute consultas anteriores para verificar novas publicações e atualizações de prazo.
          </p>
        </div>

        <button
          type="button"
          onClick={onClearHistory}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Limpar histórico</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/70 transition-colors"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {entry.params.areaTematica || 'Busca geral (todos os temas)'}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                <span>{entry.params.tipoEnte}</span>
                <span aria-hidden="true">·</span>
                <span>{entry.params.estadoRegiao}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{entry.dataConsulta}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-700">
                  {entry.totalEncontrados} encontrado(s)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onReplay(entry.params)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium text-white bg-[#0F5132] hover:bg-[#0B3F27] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Consultar novamente</span>
              </button>
              <button
                type="button"
                onClick={() => onDeleteEntry(entry.id)}
                aria-label="Remover entrada do histórico"
                className="p-2 text-slate-400 hover:text-[#B91C1C] hover:bg-red-50 rounded-md transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
