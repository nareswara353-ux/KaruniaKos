import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 max-w-md w-full">
              <div className="text-5xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                Terjadi Gangguan
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
                Kami tidak dapat memuat halaman ini. Mungkin koneksi terputus atau ada masalah teknis.
              </p>
              <button
                onClick={this.handleRetry}
                className="btn-primary w-full flex items-center justify-center gap-2">
                <span>🔄</span> Muat Ulang Halaman
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}