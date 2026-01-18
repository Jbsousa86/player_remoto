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
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-screen w-screen bg-red-900 text-white flex flex-col items-center justify-center p-8 overflow-auto">
                    <h1 className="text-3xl font-bold mb-4">Algo deu errado.</h1>
                    <p className="mb-2">Por favor, tire uma foto desta tela e envie para o suporte.</p>
                    <pre className="bg-black/50 p-4 rounded text-xs w-full max-w-2xl whitespace-pre-wrap">
                        {this.state.error?.toString()}
                    </pre>
                    <details className="mt-4 text-xs opacity-75">
                        <summary>Detalhes do Erro</summary>
                        <pre className="whitespace-pre-wrap mt-2">
                            {this.state.errorInfo?.componentStack}
                        </pre>
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-8 px-6 py-3 bg-white text-red-900 font-bold rounded shadow hover:bg-gray-200"
                    >
                        Recarregar Página
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
