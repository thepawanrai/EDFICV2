import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected UI error occurred.',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFA] p-6">
          <div className="max-w-md w-full rounded-lg border border-[#DCE7E9] bg-white p-6 space-y-4">
            <p className="text-xs font-semibold text-[#287887]">
              EDFIC Application Recovery
            </p>
            <h1 className="font-display text-xl font-bold text-[#083642]">
              Something went wrong displaying this view
            </h1>
            <p className="text-xs text-[#65747B]">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="inline-flex h-10 items-center rounded-md bg-[#0D4A5A] px-4 text-xs font-medium text-white hover:bg-[#083642] cursor-pointer"
            >
              Return to EDFIC Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
