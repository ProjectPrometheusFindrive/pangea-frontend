import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  resolvePaymentStatuses,
  type PaymentStatusResolveResult,
  type PaymentStatusSnapshot,
  type PaymentSyncTarget,
} from '../utils/paymentStatusSync';

interface UsePaymentStatusSyncOptions {
  targets: PaymentSyncTarget[];
  enabled?: boolean;
  pollIntervalMs?: number;
}

interface UsePaymentStatusSyncResult {
  byReservationId: Record<string, PaymentStatusSnapshot>;
  byPaymentId: Record<string, PaymentStatusSnapshot>;
  isSyncing: boolean;
  error: string | null;
  usingLastKnown: boolean;
  retry: () => void;
}

function normalizeTargets(targets: PaymentSyncTarget[]): PaymentSyncTarget[] {
  return targets
    .map((target) => ({
      reservationId: target.reservationId?.trim() || null,
      paymentId: target.paymentId?.trim() || null,
      fallbackStatus: target.fallbackStatus ?? null,
      fallbackUpdatedAt: target.fallbackUpdatedAt ?? null,
    }))
    .filter((target) => Boolean(target.reservationId || target.paymentId));
}

function toTargetsKey(targets: PaymentSyncTarget[]): string {
  return targets
    .map((target) => [
      target.reservationId ?? '',
      target.paymentId ?? '',
      target.fallbackStatus ?? '',
      target.fallbackUpdatedAt ?? '',
    ].join('|'))
    .sort()
    .join('||');
}

export function usePaymentStatusSync({
  targets,
  enabled = true,
  pollIntervalMs = 20_000,
}: UsePaymentStatusSyncOptions): UsePaymentStatusSyncResult {
  const normalizedTargets = useMemo(() => normalizeTargets(targets), [targets]);
  const targetsKey = useMemo(() => toTargetsKey(normalizedTargets), [normalizedTargets]);

  const [byReservationId, setByReservationId] = useState<Record<string, PaymentStatusSnapshot>>({});
  const [byPaymentId, setByPaymentId] = useState<Record<string, PaymentStatusSnapshot>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingLastKnown, setUsingLastKnown] = useState(false);

  const sequenceRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<number | null>(null);

  const applyResolveResult = useCallback((result: PaymentStatusResolveResult) => {
    setByReservationId(result.byReservationId);
    setByPaymentId(result.byPaymentId);
    setError(result.errorMessage);
    setUsingLastKnown(
      result.hasRetriableFailure
      && (Object.keys(result.byReservationId).length > 0 || Object.keys(result.byPaymentId).length > 0),
    );
  }, []);

  const runSync = useCallback(async () => {
    if (!enabled || normalizedTargets.length === 0) {
      controllerRef.current?.abort();
      setIsSyncing(false);
      setError(null);
      setUsingLastKnown(false);
      setByReservationId({});
      setByPaymentId({});
      return;
    }

    const nextSequence = sequenceRef.current + 1;
    sequenceRef.current = nextSequence;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsSyncing(true);

    try {
      const result = await resolvePaymentStatuses(normalizedTargets, {
        signal: controller.signal,
      });
      if (controller.signal.aborted || sequenceRef.current !== nextSequence) {
        return;
      }
      applyResolveResult(result);
    } catch (error) {
      if (controller.signal.aborted || sequenceRef.current !== nextSequence) {
        return;
      }

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('결제 상태 동기화에 실패했습니다.');
      }
      setUsingLastKnown(true);
    } finally {
      if (!controller.signal.aborted && sequenceRef.current === nextSequence) {
        setIsSyncing(false);
      }
    }
  }, [applyResolveResult, enabled, normalizedTargets]);

  useEffect(() => {
    const clearTimer = () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    return () => {
      clearTimer();
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const clearTimer = () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    clearTimer();

    if (!enabled || normalizedTargets.length === 0) {
      controllerRef.current?.abort();
      void runSync();
      return () => {
        clearTimer();
        controllerRef.current?.abort();
      };
    }

    void runSync();

    if (pollIntervalMs > 0) {
      intervalRef.current = window.setInterval(() => {
        void runSync();
      }, pollIntervalMs);
    }

    return () => {
      clearTimer();
      controllerRef.current?.abort();
    };
  }, [enabled, normalizedTargets.length, pollIntervalMs, runSync, targetsKey]);

  return {
    byReservationId,
    byPaymentId,
    isSyncing,
    error,
    usingLastKnown,
    retry: runSync,
  };
}
