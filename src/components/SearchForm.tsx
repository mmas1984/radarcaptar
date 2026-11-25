import { RotateCcw, Search } from 'lucide-react';
import type { FormEvent } from 'react';
import {
  AREAS_TEMATICAS_SUGERIDAS,
  ESTADOS_E_REGIOES,
  FONTES_FOCO,
  TIPOS_ENTE_PUBLICO,
} from '../utils/constants';
import type { SearchEditaisRequest } from '../types/edital';

interface SearchFormProps {
  values: SearchEditaisRequest;
  onChange: (next: SearchEditaisRequest) => void;
  onSubmit: (params: SearchEditaisRequest) => void;
  onReset: () => void;
  isLoading: boolean;
}

export function SearchForm({
  values,
  onChange,
  onSubmit,
  onReset,
  isLoading,
}: SearchFormProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(values);
  };

  return (
    <section
      aria-label="Parâmetros de busca de editais"
      className="bg-white border border-slate-200 rounded-xl p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
            Rastreador de Editais Públicos
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Busca em tempo real na web por chamadas vigentes com validação de prazo e links oficiais diretos.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 self-start sm:self-auto"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Limpar filtros</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="pt-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-4">
            <label
              htmlFor="area-tematica"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Área temática
            </label>
            <input
              id="area-tematica"
              type="text"
              value={values.areaTematica}
              onChange={(e) => onChange({ ...values, areaTematica: e.target.value })}
              placeholder="Ex.: Saneamento, Mobilidade, Saúde, Inovação..."
              maxLength={160}
              className="w-full h-10 px-3 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus:border-[#0F5132] focus:ring-2 focus:ring-[#0F5132]/15 focus:outline-none transition-colors"
            />
          </div>

          <div className="xl:col-span-3">
            <label
              htmlFor="tipo-ente"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Ente / Proponente
            </label>
            <select
              id="tipo-ente"
              value={values.tipoEnte}
              onChange={(e) => onChange({ ...values, tipoEnte: e.target.value })}
              className="w-full h-10 px-3 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-[#0F5132] focus:ring-2 focus:ring-[#0F5132]/15 focus:outline-none transition-colors"
            >
              {TIPOS_ENTE_PUBLICO.map((ente) => (
                <option key={ente} value={ente}>
                  {ente}
                </option>
              ))}
            </select>
          </div>

          <div className="xl:col-span-2">
            <label
              htmlFor="estado-regiao"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Estado / Região
            </label>
            <select
              id="estado-regiao"
              value={values.estadoRegiao}
              onChange={(e) => onChange({ ...values, estadoRegiao: e.target.value })}
              className="w-full h-10 px-3 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-[#0F5132] focus:ring-2 focus:ring-[#0F5132]/15 focus:outline-none transition-colors"
            >
              {ESTADOS_E_REGIOES.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="xl:col-span-3">
            <label
              htmlFor="fonte-foco"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Foco de órgãos
            </label>
            <select
              id="fonte-foco"
              value={values.fonteFoco || FONTES_FOCO[0]}
              onChange={(e) => onChange({ ...values, fonteFoco: e.target.value })}
              className="w-full h-10 px-3 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-[#0F5132] focus:ring-2 focus:ring-[#0F5132]/15 focus:outline-none transition-colors"
            >
              {FONTES_FOCO.map((fonte) => (
                <option key={fonte} value={fonte}>
                  {fonte}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
            <span className="font-medium text-slate-700">Temas frequentes:</span>
            {AREAS_TEMATICAS_SUGERIDAS.slice(0, 5).map((tema, idx) => (
              <span key={tema} className="inline-flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onChange({ ...values, areaTematica: tema })}
                  className="text-slate-600 hover:text-[#0F5132] underline decoration-slate-300 hover:decoration-[#0F5132] underline-offset-2 transition-colors text-left"
                >
                  {tema.split(' e ')[0]}
                </button>
                {idx < 4 && (
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                )}
              </span>
            ))}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 text-sm font-medium text-white bg-[#0F5132] hover:bg-[#0B3F27] rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span>{isLoading ? 'Rastreando editais vigentes...' : 'Buscar Editais Vigentes'}</span>
          </button>
        </div>
      </form>
    </section>
  );
}
