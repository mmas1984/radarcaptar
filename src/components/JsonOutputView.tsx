import { Check, Copy, Download, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import type { EditaisJsonPayload, GroundingSource } from '../types/edital';
import { downloadCsvFile, downloadJsonFile, formatEditaisJson } from '../utils/export';
import { extractDomainLabel, sanitizeHttpUrl } from '../utils/url';

interface JsonOutputViewProps {
  payload: EditaisJsonPayload;
  groundingSources: GroundingSource[];
  searchQueries: string[];
}

export function JsonOutputView({
  payload,
  groundingSources,
  searchQueries,
}: JsonOutputViewProps) {
  const [copied, setCopied] = useState(false);
  const formatted = formatEditaisJson(payload);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored silently
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">Saída JSON estruturada</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{payload.data_consulta}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {payload.total_encontrados} registro(s)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#15803D]" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copiar JSON</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => downloadJsonFile(payload)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Baixar .json</span>
            </button>
            {payload.editais.length > 0 && (
              <button
                type="button"
                onClick={() => downloadCsvFile(payload.editais, payload.data_consulta)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Exportar CSV</span>
              </button>
            )}
          </div>
        </div>

        <pre className="p-5 overflow-x-auto text-xs leading-relaxed font-mono bg-[#0F172A] text-slate-100 max-h-[560px]">
          <code>{formatted}</code>
        </pre>
      </div>

      {(groundingSources.length > 0 || searchQueries.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Fontes consultadas no Google Search
            </h3>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {groundingSources.length} URL(s) verificadas na consulta
            </span>
          </div>

          {searchQueries.length > 0 && (
            <div className="text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-700">Termos pesquisados: </span>
              {searchQueries.join(' · ')}
            </div>
          )}

          {groundingSources.length > 0 && (
            <ul className="divide-y divide-slate-200 border-t border-slate-200">
              {groundingSources.map((src) => {
                const safeUri = sanitizeHttpUrl(src.uri);
                if (!safeUri) return null;
                return (
                  <li key={safeUri} className="py-2.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-800 truncate">{src.title}</div>
                      <div className="text-xs font-mono text-slate-500 truncate">
                        {extractDomainLabel(safeUri)}
                      </div>
                    </div>
                    <a
                      href={safeUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#0F5132] hover:underline whitespace-nowrap shrink-0"
                    >
                      <span>Abrir fonte</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
