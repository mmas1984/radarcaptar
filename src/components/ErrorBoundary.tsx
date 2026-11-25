import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Erro inesperado ao renderizar a interface.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Radar Capta runtime error:', error, info);
  }

  handleReset = () => {
    try {
      window.localStorage.removeItem('radar_capta_saved_v1');
      window.localStorage.removeItem('radar_capta_history_v1');
    } catch {
      // Ignore storage failures
    }
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h1 className="font-display text-lg font-semibold text-slate-900">
              Ocorreu um erro ao carregar o Radar Capta
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="h-10 px-4 text-sm font-medium text-white bg-[#0F5132] hover:bg-[#0B3F27] rounded-lg transition-colors cursor-pointer"
            >
              Limpar cache local e recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
