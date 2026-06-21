import React from 'react';

interface State { hasError: boolean; error?: Error }

/**
 * ErrorBoundary — 攔截子樹的 render 例外，顯示友善錯誤頁而非整頁白畫面。
 * 包在路由內容外層；單一頁面崩潰不影響其餘導覽。
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 正式環境可改接錯誤回報服務（Sentry 等）
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full text-center bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4 text-2xl">⚠️</div>
            <h1 className="text-lg font-bold text-slate-800">畫面發生錯誤</h1>
            <p className="text-sm text-slate-500 mt-2">此頁面遇到未預期的問題，其他功能不受影響。</p>
            {this.state.error && (
              <pre className="mt-3 text-[11px] text-left text-slate-400 bg-slate-50 rounded-lg p-3 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-5 bg-[#007AFF] hover:bg-[#0066CC] text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              重新載入
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
