import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cbvp-dark-light via-cbvp-dark to-cbvp-dark-lighter p-4">
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cbvp-red/10 mb-4">
              <AlertTriangle className="w-8 h-8 text-cbvp-red" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Algo salio mal</h2>
            <p className="text-sm text-white/50 mb-4">
              Ocurrio un error inesperado. Intenta recargar la pagina.
            </p>
            {this.state.error && (
              <p className="text-xs text-white/30 bg-white/5 rounded-lg p-2 mb-4 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl transition-colors text-sm"
              >
                Intentar de nuevo
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 bg-cbvp-red hover:bg-cbvp-red/80 text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Recargar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
