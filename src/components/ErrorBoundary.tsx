import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error in component tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[350px] flex flex-col items-center justify-center p-8 text-center bg-[#FDFBF7] rounded-3xl border border-[#EADDCA] my-6 max-w-xl mx-auto shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-extrabold text-[#2D2A26] mb-2">화면 로딩 중 일시적인 문제가 발생했습니다</h2>
          <p className="text-xs text-[#8C8379] mb-6 max-w-md leading-relaxed">
            데이터 처리 또는 렌더링 중 예기치 못한 문제가 발생했습니다. 아래 버튼을 눌러 화면을 다시 시도해 주세요.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (this.props.onReset) this.props.onReset();
              }}
              className="px-4 py-2.5 bg-[#5A8F7B] hover:bg-[#4D7D6B] text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-xs transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>화면 다시 불러오기</span>
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
              className="px-4 py-2.5 bg-white hover:bg-[#F5EFE6] border border-[#EADDCA] text-[#2D2A26] rounded-xl text-xs font-bold transition-colors"
            >
              새로고침
            </button>
          </div>
          {this.state.error && (
            <details className="mt-5 text-left w-full">
              <summary className="text-[11px] text-[#8C8379] cursor-pointer hover:underline text-center">오류 기술 정보</summary>
              <pre className="mt-2 p-3 bg-white border border-[#EADDCA] rounded-xl text-[10px] text-rose-600 overflow-x-auto font-mono whitespace-pre-wrap">
                {this.state.error.message || String(this.state.error)}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
