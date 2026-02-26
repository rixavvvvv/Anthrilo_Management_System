'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

/**
 * Global Error Boundary — catches any unhandled React errors
 * and shows a recovery UI instead of a blank screen.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in dev — swap with Sentry/LogRocket in production
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-rose-50/20 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
          <div className="max-w-md w-full">
            <div className="rounded-3xl border border-white/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-8 pt-10 pb-4 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/30 mb-5">
                  <AlertTriangle className="w-7 h-7 text-rose-500" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Something went wrong
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  An unexpected error occurred. Please try refreshing the page.
                </p>
              </div>

              {/* Error details (dev only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mx-8 mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 overflow-auto max-h-40">
                  <p className="text-xs font-mono text-rose-600 dark:text-rose-400 break-all">
                    {this.state.error.toString()}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="px-8 pb-8 flex flex-col gap-2.5">
                <button
                  onClick={this.handleReload}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                    bg-gradient-to-r from-primary-600 to-violet-600
                    shadow-lg shadow-primary-500/25
                    hover:shadow-primary-500/40 hover:-translate-y-0.5
                    transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Page
                </button>
                <button
                  onClick={this.handleHome}
                  className="w-full py-2.5 rounded-xl text-sm font-medium
                    bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300
                    hover:bg-slate-200 dark:hover:bg-slate-700
                    transition-all flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Go to Dashboard
                </button>
                <button
                  onClick={this.handleReset}
                  className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  Try rendering again
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
