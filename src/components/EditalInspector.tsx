import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  ExternalLink,
  FileSearch,
  Loader2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  EditalDeepAnalysis,
  EditalItem,
  SavedEdital,
  TrackingStatus,
} from '../types/edital';
import { TRACKING_STATUS_LABELS } from '../utils/constants';
import { analyzeTransferegovClientFallback } from '../utils/clientFallback';
import { classifyDeadline, extractDomainLabel, sanitizeHttpUrl } from '../utils/url';

interface EditalInspectorProps {
  edital: EditalItem | null;
  dataConsulta: string;
  savedRecord: SavedEdital | undefined;
  onClose: () => void;
  onToggleSave: (edital: EditalItem) => void;
  onUpdateSavedMeta: (id: string, status: TrackingStatus, notas: string) => void;
}

export function EditalInspector({
  edital,
  dataConsulta,
  savedRecord,
  onClose,
  onToggleSave,
  onUpdateSavedMeta,
}: EditalInspectorProps) {
  const [copiedJson, setCopiedJson] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<EditalDeepAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    setAnalysis(null);
    setAnalysisError(null);
    setAnalyzing(false);
    setCopiedJson(false);
  }, [edital?.id]);

  useEffect(() => {
    if (!edital) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [edital, onClose]);

  if (!edital) return null;

  const safeUrl = sanitizeHttpUrl(edital.url_oficial);
  const deadlineInfo = classifyDeadline(edital.prazo_submissao, dataConsulta);

  const handleCopyItemJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(edital, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleAnalyzePage = async () => {
    if (!safeUrl || analyzing) return;
    setAnalyzing(true);
    setAnalysisError(null);

    try {
      let result: EditalDeepAnalysis | null = null;
      let useStaticFallback = false;

      try {
        const response = await fetch('./api/analyze-edital', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo: edital.titulo,
            orgaoEmissor: edital.orgao_emissor,
            urlOficial: safeUrl,
          }),
        });
        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');

        if (!isJson && (response.status === 404 || response.status === 405 || !response.ok)) {
          useStaticFallback = true;
        } else if (!isJson) {
          useStaticFallback = true;
        } else {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data?.error || 'Não foi possível analisar os requisitos desta página.');
          }
          result = data as EditalDeepAnalysis;
        }
      } catch (fetchErr) {
        if (fetchErr instanceof TypeError) {
          useStaticFallback = true;
        } else {
          throw fetchErr;
        }
      }

      if (useStaticFallback || !result) {
        result = await analyzeTransferegovClientFallback(safeUrl);
      }

      setAnalysis(result);
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'Falha ao consultar a página do edital.',
      );
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Detalhes do edital">
      <div
        className="fixed inset-0 bg-slate-900/35"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-xl bg-white h-full border-l border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700 truncate">{edital.orgao_emissor}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono truncate">{edital.id}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel de detalhes"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900 leading-snug">
              {edital.titulo}
            </h2>
            <p className="text-sm text-slate-600 mt-2.5 leading-relaxed">
              {edital.resumo_objeto}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {safeUrl && (
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-white bg-[#0F5132] hover:bg-[#0B3F27] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <span>Acessar Página Oficial</span>
                <ExternalLink className="h-4 w-4 shrink-0" />
              </a>
            )}

            <button
              type="button"
              onClick={() => onToggleSave(edital)}
              className={`inline-flex items-center gap-1.5 h-10 px-3.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                savedRecord
                  ? 'border-[#0F5132] text-[#0F5132] bg-[#0F5132]/5'
                  : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50'
              }`}
            >
              {savedRecord ? (
                <>
                  <BookmarkCheck className="h-4 w-4" />
                  <span>Salvo</span>
                </>
              ) : (
                <>
                  <Bookmark className="h-4 w-4" />
                  <span>Salvar</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopyItemJson}
              className="inline-flex items-center gap-1.5 h-10 px-3.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedJson ? (
                <>
                  <Check className="h-4 w-4 text-[#15803D]" />
                  <span>JSON copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copiar JSON</span>
                </>
              )}
            </button>
          </div>

          <dl className="divide-y divide-slate-200 border-t border-b border-slate-200 text-sm">
            <div className="py-3.5 grid grid-cols-3 gap-4">
              <dt className="text-xs font-semibold text-slate-500">Prazo de submissão</dt>
              <dd className="col-span-2">
                <div className="font-mono text-xs font-medium text-slate-900 tabular-nums">
                  {edital.prazo_submissao}
                </div>
                <div
                  className={`text-xs mt-0.5 font-medium ${
                    deadlineInfo.urgency === 'urgent'
                      ? 'text-[#B45309]'
                      : deadlineInfo.urgency === 'continuous'
                        ? 'text-[#15803D]'
                        : 'text-[#0F5132]'
                  }`}
                >
                  {deadlineInfo.urgency === 'urgent' && deadlineInfo.daysLeft !== null
                    ? `Atenção: encerra em aproximadamente ${deadlineInfo.daysLeft} dia(s)`
                    : deadlineInfo.urgency === 'continuous'
                      ? 'Recebimento em fluxo contínuo'
                      : 'Prazo vigente'}
                </div>
              </dd>
            </div>

            <div className="py-3.5 grid grid-cols-3 gap-4">
              <dt className="text-xs font-semibold text-slate-500">Valor / Teto</dt>
              <dd className="col-span-2 font-mono text-xs font-medium text-slate-900 tabular-nums">
                {edital.valor_total_ou_teto}
              </dd>
            </div>

            <div className="py-3.5 grid grid-cols-3 gap-4">
              <dt className="text-xs font-semibold text-slate-500">Elegibilidade</dt>
              <dd className="col-span-2 text-slate-800">{edital.elegibilidade}</dd>
            </div>

            <div className="py-3.5 grid grid-cols-3 gap-4">
              <dt className="text-xs font-semibold text-slate-500">Fonte de recurso</dt>
              <dd className="col-span-2 text-slate-800">{edital.fonte_recurso}</dd>
            </div>

            <div className="py-3.5 grid grid-cols-3 gap-4">
              <dt className="text-xs font-semibold text-slate-500">URL oficial</dt>
              <dd className="col-span-2 break-all font-mono text-xs text-slate-700">
                {safeUrl ? (
                  <a
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0F5132] hover:underline"
                  >
                    {safeUrl}
                  </a>
                ) : (
                  'Indisponível'
                )}
              </dd>
            </div>
          </dl>

          {savedRecord && (
            <div className="space-y-3 pt-1">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Acompanhamento interno
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="tracking-status"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    Situação da proposta
                  </label>
                  <select
                    id="tracking-status"
                    value={savedRecord.status}
                    onChange={(e) =>
                      onUpdateSavedMeta(
                        savedRecord.id,
                        e.target.value as TrackingStatus,
                        savedRecord.notas,
                      )
                    }
                    className="w-full h-9 px-2.5 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-[#0F5132] focus:outline-none"
                  >
                    {(Object.keys(TRACKING_STATUS_LABELS) as TrackingStatus[]).map((key) => (
                      <option key={key} value={key}>
                        {TRACKING_STATUS_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-xs text-slate-500 flex items-end pb-2 font-mono tabular-nums">
                  Salvo em {savedRecord.savedAt.slice(0, 10)}
                </div>
              </div>
              <div>
                <label
                  htmlFor="tracking-notes"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Anotações da equipe técnica
                </label>
                <textarea
                  id="tracking-notes"
                  rows={3}
                  value={savedRecord.notas}
                  onChange={(e) =>
                    onUpdateSavedMeta(savedRecord.id, savedRecord.status, e.target.value)
                  }
                  placeholder="Registre secretaria responsável, certidões pendentes ou contrapartida..."
                  className="w-full p-2.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus:border-[#0F5132] focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="pt-2 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Leitura de requisitos na página oficial
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Extrai contrapartida, documentação e etapas diretamente da publicação oficial.
                </p>
              </div>
              {safeUrl && (
                <button
                  type="button"
                  onClick={handleAnalyzePage}
                  disabled={analyzing}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Analisando...</span>
                    </>
                  ) : (
                    <>
                      <FileSearch className="h-3.5 w-3.5" />
                      <span>{analysis ? 'Atualizar análise' : 'Analisar requisitos'}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {analysisError && (
              <div className="p-3.5 border border-red-200 rounded-lg text-xs text-[#B91C1C] flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{analysisError}</span>
              </div>
            )}

            {analysis && (
              <div className="border-t border-slate-200 pt-4 space-y-4 text-xs">
                <div>
                  <div className="font-semibold text-slate-700 mb-1">Contrapartida</div>
                  <p className="text-slate-700 leading-relaxed">{analysis.contrapartida}</p>
                </div>

                {analysis.documentos_exigidos.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-700 mb-1.5">
                      Documentos e certidões citados
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 leading-relaxed">
                      {analysis.documentos_exigidos.map((doc, idx) => (
                        <li key={idx}>{doc}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.cronograma_chaves.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-700 mb-1.5">Marcos do cronograma</div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 leading-relaxed">
                      {analysis.cronograma_chaves.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.etapas_submissao.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-700 mb-1.5">Etapas de submissão</div>
                    <ol className="list-decimal pl-4 space-y-1 text-slate-700 leading-relaxed">
                      {analysis.etapas_submissao.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {analysis.pontos_atencao.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-700 mb-1.5">Pontos de atenção</div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 leading-relaxed">
                      {analysis.pontos_atencao.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.fontes_verificadas.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="font-semibold text-slate-700 mb-1">Fontes consultadas</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {analysis.fontes_verificadas.map((src) => {
                        const uri = sanitizeHttpUrl(src.uri);
                        if (!uri) return null;
                        return (
                          <a
                            key={uri}
                            href={uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0F5132] hover:underline font-mono text-[11px]"
                          >
                            {extractDomainLabel(uri)}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
