import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
};

type State = { error: Error | null };

/** Keeps the chrome visible when a student-view / preview subtree throws. */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="m-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
        <p className="font-semibold">{this.props.fallbackTitle ?? "This page hit an error"}</p>
        <p className="mt-1 text-red-800">{this.state.error.message || String(this.state.error)}</p>
        <button
          type="button"
          className="btn-canvas-secondary mt-3 text-sm"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    );
  }
}
