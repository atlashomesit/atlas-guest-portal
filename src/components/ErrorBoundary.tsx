import { Component, ReactNode } from 'react';
import { Button } from './ui/Button';
import { reportError, logUserAction } from '../lib/monitoring';

interface ErrorBoundaryProps {
  children: ReactNode;
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    const boundaryName = this.props.name ?? 'app';
    logUserAction('error_boundary_triggered', { boundary: boundaryName });
    reportError(error, { boundaryName, errorInfo, tags: { boundary: boundaryName } });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-bg-muted text-center p-6 gap-4">
          <h1 className="text-2xl font-semibold text-text-primary">Something went wrong</h1>
          <p className="text-text-muted max-w-xl">
            Please try reloading the page. If the problem persists, contact support or return to the home page to continue
            browsing.
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <Button type="button" onClick={this.handleReload}>
              Reload
            </Button>
            <a
              href="/"
              className="px-5 py-2 border border-border-subtle text-text-primary rounded-lg shadow-level1 hover:bg-bg-muted transition"
            >
              Back to Home
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
