import React, { Component, ErrorInfo } from 'react';
import { motion } from 'motion/react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRecover?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  recoveryAttempts: number;
}

export class CodeEditorErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryAttempts: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('❌ Code Editor Error:', error, errorInfo);
    
    this.setState({
      errorInfo,
    });

    this.props.onError?.(error, errorInfo);
  }

  handleRecover = (): void => {
    const { recoveryAttempts } = this.state;
    
    if (recoveryAttempts < 3) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        recoveryAttempts: recoveryAttempts + 1,
      });
      
      this.props.onRecover?.();
    } else {
      this.setState({
        error: new Error('Multiple recovery attempts failed. Please reload the page.'),
      });
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, recoveryAttempts } = this.state;

      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 z-[6000] bg-[#1A1A1E] flex items-center justify-center p-8"
        >
          <div className="bg-black/40 border border-white/10 rounded-xl max-w-lg w-full p-8 text-center shadow-2xl">
            <div className="text-5xl mb-4">🔧</div>
            
            <h2 className="text-red-400 text-xl font-semibold mb-2">
              Editor Encountered an Error
            </h2>
            
            <p className="text-gray-400 mb-6 text-sm">
              {error?.message || 'An unexpected error occurred in the code editor'}
            </p>

            <div className="flex justify-center gap-3 mb-6">
              <button
                onClick={this.handleRecover}
                disabled={recoveryAttempts >= 3}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  recoveryAttempts >= 3 
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed' 
                    : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                }`}
              >
                {recoveryAttempts >= 3 ? 'Recovery Failed' : `Recover (${recoveryAttempts}/3)`}
              </button>

              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 transition-colors text-sm font-medium"
              >
                Reload Page
              </button>
            </div>

            {errorInfo && (
              <details className="text-left mt-6 pt-6 border-t border-white/10 w-full group">
                <summary className="text-gray-500 cursor-pointer text-xs font-medium hover:text-gray-400 transition-colors outline-none">
                  View Error Details
                </summary>
                <div className="mt-3 bg-black/60 p-4 rounded-md border border-white/5 overflow-auto max-h-48 text-[11px] text-gray-400 font-mono">
                  {error?.stack}
                  {'\n\n'}
                  Component Stack:
                  {errorInfo?.componentStack}
                </div>
              </details>
            )}
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}

export default CodeEditorErrorBoundary;
