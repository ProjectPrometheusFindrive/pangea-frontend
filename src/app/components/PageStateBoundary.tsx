import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

import { cn } from './ui/utils';

type PageFallbackVariant = 'loading' | 'error' | 'empty';

interface PageFallbackProps {
  variant: PageFallbackVariant;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

const DEFAULT_FALLBACK_COPY: Record<PageFallbackVariant, { title: string; description: string }> = {
  loading: {
    title: '데이터를 불러오는 중입니다',
    description: '잠시만 기다려 주세요.',
  },
  error: {
    title: '데이터를 불러오지 못했습니다',
    description: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
  },
  empty: {
    title: '표시할 데이터가 없습니다',
    description: '검색어나 필터 조건을 조정해 다시 확인해 주세요.',
  },
};

export function PageFallback({
  variant,
  title,
  description,
  onRetry,
  retryLabel = '다시 시도',
  className,
}: PageFallbackProps) {
  const copy = DEFAULT_FALLBACK_COPY[variant];

  return (
    <div
      className={cn(
        'flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12',
        className,
      )}
    >
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <div
          className={cn(
            'mb-3 rounded-full p-3',
            variant === 'loading' && 'bg-blue-50 text-blue-600',
            variant === 'error' && 'bg-red-50 text-red-600',
            variant === 'empty' && 'bg-gray-100 text-gray-600',
          )}
        >
          {variant === 'loading' && <Loader2 className="h-6 w-6 animate-spin" />}
          {variant === 'error' && <AlertTriangle className="h-6 w-6" />}
          {variant === 'empty' && <Inbox className="h-6 w-6" />}
        </div>
        <h3 className="text-base font-semibold text-gray-900">{title ?? copy.title}</h3>
        <p className="mt-1 text-sm text-gray-500">{description ?? copy.description}</p>
        {variant === 'error' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

interface PageStateBoundaryProps {
  isLoading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  loadingTitle?: string;
  loadingDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  children: ReactNode;
}

export function PageStateBoundary({
  isLoading = false,
  error = null,
  isEmpty = false,
  loadingTitle,
  loadingDescription,
  errorTitle,
  errorDescription,
  emptyTitle,
  emptyDescription,
  onRetry,
  retryLabel,
  className,
  children,
}: PageStateBoundaryProps) {
  if (isLoading) {
    return (
      <PageFallback
        variant="loading"
        title={loadingTitle}
        description={loadingDescription}
        className={className}
      />
    );
  }

  if (error) {
    return (
      <PageFallback
        variant="error"
        title={errorTitle}
        description={errorDescription ?? error}
        onRetry={onRetry}
        retryLabel={retryLabel}
        className={className}
      />
    );
  }

  if (isEmpty) {
    return (
      <PageFallback
        variant="empty"
        title={emptyTitle}
        description={emptyDescription}
        className={className}
      />
    );
  }

  return <>{children}</>;
}
