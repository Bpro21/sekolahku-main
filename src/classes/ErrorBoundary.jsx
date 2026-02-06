import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 bg-red-50 text-red-900 rounded-xl border border-red-200">
                    <h2 className="text-xl font-bold mb-2">Terjadi Kesalahan!</h2>
                    <details className="whitespace-pre-wrap text-sm font-mono bg-white p-4 rounded border border-red-100 overflow-auto">
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                    <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded font-bold">Refresh Halaman</button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
