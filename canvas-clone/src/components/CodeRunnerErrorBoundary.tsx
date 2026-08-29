import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = { error: Error | null };

/** Isolates code-runner UI failures (#155) so the rest of the question card still works. */
export default class CodeRunnerErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Code runner error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          <p className="font-semibold">Code runner could not load</p>
          <p className="mt-1 text-red-800">
            {this.state.error.message || String(this.state.error)}
          </p>
          <button
            type="button"
            className="mt-2 rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
