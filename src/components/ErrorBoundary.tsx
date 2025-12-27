import { Component, ReactNode } from 'react';
import ErrorLayout from './ErrorLayout';
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
        <ErrorLayout
          title="We couldn’t load this page"
          description="Something unexpected happened while rendering this view. Please try again or head back to the home page."
          primaryAction={{ label: "Try again", onClick: this.handleReload }}
          secondaryAction={{ label: "Back to home", href: "/" }}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
