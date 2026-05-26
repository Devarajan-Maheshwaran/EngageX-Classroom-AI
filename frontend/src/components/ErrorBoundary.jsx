import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#030712', color: '#f87171', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Something went wrong.</h1>
          <p style={{ marginTop: '10px' }}>{this.state.error && this.state.error.toString()}</p>
          <pre style={{ marginTop: '10px', backgroundColor: '#1e1e2e', padding: '10px', borderRadius: '5px', overflowX: 'auto' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
