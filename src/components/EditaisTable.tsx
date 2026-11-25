import {
  AlertCircle,
  ArrowUpDown,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  ExternalLink,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { EditalItem } from '../types/edital';
import { classifyDeadline, extractDomainLabel, sanitizeHttpUrl } from '../utils/url';

interface EditaisTableProps {
  editais: EditalItem[];
  dataConsulta: string;
  isLoading: boolean;
  hasSearched: boolean;
  error: string | null;
  aviso?: string;
  savedIds: Set<string>;
  selectedId: string | null;
  onSelectEdital: (edital: EditalItem) => void;
  onToggleSave: (edital: EditalItem) => void;
  onRetrySearch: () => void;
}

type SortMode = 'default' | 'orgao' | 'prazo';

function extractSortableDate(prazo: string): number {
  const lower = prazo.toLowerCase();
  if (lower.includes('fluxo contínuo') || lower.includes('fluxo continuo')) {
    return Number.MAX_SAFE_INTEGER - 1;
  }
  const match = prazo.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  return Date.UTC(year, month - 1, day);
}

export function EditaisTable({
  editais,
  dataConsulta,
  isLoading,
  hasSearched,
  error,
  aviso,
  savedIds,
  selectedId,
  onSelectEdital,
  onToggleSave,
  onRetrySearch,
}: EditaisTableProps) {
  const [filterText, setFilterText] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('default');

  const filteredAndSorted = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    const list = query
      ? editais.filter(
          (item) =>
            item.titulo.toLowerCase().includes(query) ||
            item.orgao_emissor.toLowerCase().includes(query) ||
            item.resumo_objeto.toLowerCase().includes(query) ||
            item.elegibilidade.toLowerCase().includes(query) ||
            item.fonte_recurso.toLowerCase().includes(query) ||
            item.id.toLowerCase().includes(query),
        )
      : [...editais];

    if (sortMode === 'orgao') {
      list.sort((a, b) => a.orgao_emissor.localeCompare(b.orgao_emissor, 'pt-BR'));
    } else if (sortMode === 'prazo') {
      list.sort((a, b) => extractSortableDate(a.prazo_submissao) - extractSortableDate(b.prazo_submissao));
    }
    return list;
  }, [editais, filterText, sortMode]);

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="text-sm font-medium text-slate-700">
            Consultando portais oficiais em tempo real e validando vigência...
          </div>
          <span className="text-xs font-mono text-slate-400">Google Search</span>
        </div>
        <div className="divide-y divide-slate-200">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="px-5 py-4 grid grid-cols-12 gap-4 items-center animate-pulse">
              <div className="col-span-12 md:col-span-5 space-y-2">
                <div className="h-3 w-40 bg-slate-200 rounded" />
                <div className="h-4 w-11/12 bg-slate-200 rounded" />
                <div className="h-3 w-4/5 bg-slate-100 rounded" />
              </div>
              <div className="hidden md:block md:col-span-3 space-y-2">
                <div className="h-3.5 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-24 bg-slate-100 rounded" />
              </div>
              <div className="hidden md:block md:col-span-2">
                <div className="h-4 w-24 bg-slate-200 rounded ml-auto" />
              </div>
              <div className="hidden md:block md:col-span-2">
                <div className="h-4 w-24 bg-slate-200 rounded ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="bg-white border border-red-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-[#B91C1C] shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Erro na consulta em tempo real
            </h3>
            <p className="text-sm text-slate-600 mt-1">{error}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetrySearch}
          className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center">
        <h3 className="font-display text-lg font-semibold text-slate-900">
          Pronto para rastrear oportunidades vigentes
        </h3>
        <p className="text-sm text-slate-600 max-w-xl mx-auto mt-2 leading-relaxed">
          Defina a área temática, o perfil do ente público e o recorte territorial acima — ou selecione uma consulta rápida no menu lateral — para localizar editais abertos com links oficiais verificados.
        </p>
      </div>
    );
  }

  if (editais.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center">
        <h3 className="font-display text-lg font-semibold text-slate-900">
          Nenhum edital vigente encontrado para estes filtros
        </h3>
        <p className="text-sm text-slate-600 max-w-xl mx-auto mt-2 leading-relaxed">
          {aviso ||
            'Não foram localizadas chamadas abertas ou futuras com prazo ativo para a combinação pesquisada. Tente ampliar a abrangência para Nacional ou usar termos mais amplos na área temática.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {aviso && (
        <div className="px-5 py-2.5 bg-amber-50/70 border-b border-amber-200/80 text-xs text-amber-900">
          {aviso}
        </div>
      )}

      <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filtrar resultados por órgão, tema ou palavra..."
            aria-label="Filtrar editais carregados"
            className="w-full h-9 pl-9 pr-3 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:bg-white focus:border-[#0F5132] focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
            {filteredAndSorted.length} de {editais.length}
          </span>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <select
              aria-label="Ordenar editais"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="h-9 px-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:border-[#0F5132] focus:outline-none"
            >
              <option value="default">Relevância da busca</option>
              <option value="prazo">Prazo mais próximo</option>
              <option value="orgao">Órgão emissor (A–Z)</option>
            </select>
          </div>
        </div>
      </div>

      {filteredAndSorted.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-slate-600">
          Nenhum edital corresponde ao filtro “{filterText}”.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                <th className="py-3 pl-5 pr-4 w-[42%]">Chamada pública e órgão</th>
                <th className="py-3 px-4 w-[22%]">Elegibilidade e fonte</th>
                <th className="py-3 px-4 text-right w-[14%]">Valor / Teto</th>
                <th className="py-3 px-4 text-right w-[14%]">Prazo</th>
                <th className="py-3 pl-3 pr-5 text-right w-[8%]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredAndSorted.map((item) => {
                const isSaved = savedIds.has(item.id);
                const isSelected = selectedId === item.id;
                const safeUrl = sanitizeHttpUrl(item.url_oficial);
                const deadlineInfo = classifyDeadline(item.prazo_submissao, dataConsulta);

                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelectEdital(item)}
                    className={`group cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#0F5132]/5' : 'hover:bg-slate-50/90'
                    }`}
                  >
                    <td className="py-4 pl-5 pr-4 align-top">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <span className="font-semibold text-slate-700 truncate max-w-[260px]">
                          {item.orgao_emissor}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[11px] text-slate-500 truncate max-w-[140px]">
                          {item.id}
                        </span>
                      </div>
                      <div className="font-medium text-slate-900 group-hover:text-[#0F5132] transition-colors leading-snug">
                        {item.titulo}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                        {item.resumo_objeto}
                      </p>
                      {safeUrl && (
                        <div className="mt-1.5 text-[11px] font-mono text-slate-400 truncate max-w-[380px]">
                          {extractDomainLabel(safeUrl)}
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4 align-top">
                      <div className="text-xs font-medium text-slate-800 leading-snug">
                        {item.elegibilidade}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 leading-snug">
                        {item.fonte_recurso}
                      </div>
                    </td>

                    <td className="py-4 px-4 align-top text-right">
                      <div className="font-mono text-xs font-medium text-slate-900 tabular-nums leading-snug">
                        {item.valor_total_ou_teto}
                      </div>
                    </td>

                    <td className="py-4 px-4 align-top text-right">
                      <div className="font-mono text-xs font-medium text-slate-900 tabular-nums leading-snug">
                        {item.prazo_submissao}
                      </div>
                      <div
                        className={`text-[11px] font-medium mt-1 ${
                          deadlineInfo.urgency === 'urgent'
                            ? 'text-[#B45309]'
                            : deadlineInfo.urgency === 'continuous'
                              ? 'text-[#15803D]'
                              : 'text-[#0F5132]'
                        }`}
                      >
                        {deadlineInfo.urgency === 'urgent' && deadlineInfo.daysLeft !== null
                          ? `Prazo próximo (${deadlineInfo.daysLeft}d)`
                          : deadlineInfo.urgency === 'continuous'
                            ? 'Fluxo contínuo'
                            : 'Inscrições vigentes'}
                      </div>
                    </td>

                    <td
                      className="py-4 pl-3 pr-5 align-top text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onToggleSave(item)}
                          title={isSaved ? 'Remover dos salvos' : 'Salvar no acompanhamento'}
                          aria-label={isSaved ? 'Remover dos salvos' : 'Salvar no acompanhamento'}
                          className={`p-2 rounded-md transition-colors cursor-pointer ${
                            isSaved
                              ? 'text-[#0F5132] bg-[#0F5132]/10'
                              : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          {isSaved ? (
                            <BookmarkCheck className="h-4 w-4" />
                          ) : (
                            <Bookmark className="h-4 w-4" />
                          )}
                        </button>

                        {safeUrl && (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir página oficial do edital"
                            aria-label="Abrir página oficial do edital"
                            className="p-2 rounded-md text-slate-400 hover:text-[#0F5132] hover:bg-slate-100 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => onSelectEdital(item)}
                          title="Inspecionar detalhes"
                          aria-label="Inspecionar detalhes"
                          className="p-2 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
