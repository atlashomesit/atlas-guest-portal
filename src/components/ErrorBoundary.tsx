import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
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
    if (import.meta.env.DEV) {
      console.error('Application error caught by boundary', error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-6 gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">Something went wrong</h1>
          <p className="text-gray-600 max-w-xl">
            Please try reloading the page. If the problem persists, contact support or return to the home page to continue
            browsing.
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-5 py-2 bg-primary text-white rounded-lg shadow-sm hover:shadow-md transition"
            >
              Reload
            </button>
            <a
              href="/"
              className="px-5 py-2 border border-gray-300 text-gray-800 rounded-lg shadow-sm hover:bg-gray-100 transition"
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
