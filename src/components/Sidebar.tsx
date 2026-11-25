import { Bookmark, Clock, Compass, X } from 'lucide-react';
import { STRATEGIC_PRESETS } from '../utils/constants';
import type { SearchEditaisRequest } from '../types/edital';

export type ActiveSection = 'rastreador' | 'salvos' | 'historico';

interface SidebarProps {
  activeSection: ActiveSection;
  onSelectSection: (section: ActiveSection) => void;
  savedCount: number;
  historyCount: number;
  onApplyPreset: (params: SearchEditaisRequest) => void;
  isSearching: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  activeSection,
  onSelectSection,
  savedCount,
  historyCount,
  onApplyPreset,
  isSearching,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navItems: {
    id: ActiveSection;
    label: string;
    icon: typeof Compass;
    count?: number;
  }[] = [
    { id: 'rastreador', label: 'Rastreador', icon: Compass },
    { id: 'salvos', label: 'Acompanhamento', icon: Bookmark, count: savedCount },
    { id: 'historico', label: 'Histórico', icon: Clock, count: historyCount },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      <div className="flex h-16 items-center justify-between px-6 border-b border-slate-200 shrink-0">
        <button
          type="button"
          onClick={() => {
            onSelectSection('rastreador');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 rounded-md"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0 text-[#0F5132]"
          >
            <rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1.75" />
            <path d="M7 15.5V8.5H12.2C13.9 8.5 15 9.5 15 11C15 12.5 13.9 13.5 12.2 13.5H7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12.5 13.5L16.5 16.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900">
            Radar Capta
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Fechar menu lateral"
          className="lg:hidden p-2 text-slate-500 hover:text-slate-900 rounded-md"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        <nav aria-label="Navegação principal" className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#0F5132]/8 text-[#0F5132]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="font-mono text-xs tabular-nums text-slate-500">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 pt-6">
          <h2 className="px-3 text-xs font-semibold text-slate-500 mb-3">
            Consultas rápidas
          </h2>
          <div className="space-y-1">
            {STRATEGIC_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={isSearching}
                onClick={() => {
                  onApplyPreset(preset.params);
                  onCloseMobile();
                }}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <div className="text-sm font-medium text-slate-800 truncate">
                  {preset.label}
                </div>
                <div className="text-xs text-slate-500 truncate mt-0.5">
                  {preset.subtitle}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-6 py-4 text-xs text-slate-500 leading-relaxed">
        Fontes oficiais monitoradas: Transferegov, BNDES, FINEP, Ministérios, FAPs e organismos internacionais.
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[264px] shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[280px] max-w-[85vw] h-full">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
