import { useCallback, useEffect, type MouseEvent } from 'react';

interface UseModalDismissOptions {
  isOpen: boolean;
  onDismiss: () => void | boolean;
  disabled?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
}

export function useModalDismiss({
  isOpen,
  onDismiss,
  disabled = false,
  closeOnEscape = true,
  closeOnBackdrop = true,
}: UseModalDismissOptions) {
  useEffect(() => {
    if (!isOpen || disabled || !closeOnEscape) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeOnEscape, disabled, isOpen, onDismiss]);

  const handleBackdropMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!isOpen || disabled || !closeOnBackdrop || event.target !== event.currentTarget) {
      return;
    }
    onDismiss();
  }, [closeOnBackdrop, disabled, isOpen, onDismiss]);

  return { handleBackdropMouseDown };
}
