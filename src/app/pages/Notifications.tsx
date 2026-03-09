import { Bell, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { ApiError } from '../../services/api';
import {
  getNotifications,
  markNotificationAsRead,
  type NotificationItem,
} from '../../services/notifications';
import { Layout } from '../components/Layout';
import { resolveRoutePermissionForPath } from '../authorization';
import { useAuthorization } from '../context/AuthorizationContext';

function toNotificationErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.message) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '알림을 불러오지 못했습니다. 다시 시도해 주세요.';
}

function toRelativeTimeLabel(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  const diffMs = Date.now() - parsedDate.getTime();
  if (diffMs < 60_000) {
    return '방금 전';
  }
  if (diffMs < 3_600_000) {
    return `${Math.floor(diffMs / 60_000)}분 전`;
  }
  if (diffMs < 86_400_000) {
    return `${Math.floor(diffMs / 3_600_000)}시간 전`;
  }
  return parsedDate.toLocaleDateString('ko-KR');
}

export default function Notifications() {
  const navigate = useNavigate();
  const { canAccessRoute } = useAuthorization();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await getNotifications({ limit: 100, signal });
      if (signal?.aborted) {
        return;
      }
      setItems(payload.items);
    } catch (nextError) {
      if (!signal?.aborted) {
        setError(toNotificationErrorMessage(nextError));
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadNotifications(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadNotifications]);

  const handleNotificationClick = useCallback(async (notification: NotificationItem) => {
    const routePermission = resolveRoutePermissionForPath(notification.path);
    if (routePermission && !canAccessRoute(routePermission)) {
      navigate('/forbidden');
      return;
    }

    if (!notification.isRead) {
      try {
        await markNotificationAsRead(notification.id);
      } catch {
        // Keep navigation responsive even if read-state persistence fails.
      }
    }

    navigate(notification.path);
  }, [canAccessRoute, navigate]);

  return (
    <Layout title="모든 알림">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-50 p-3 text-blue-600">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">알림 히스토리</h2>
              <p className="text-sm text-gray-500">최근 알림을 시간순으로 확인하고 관련 화면으로 이동할 수 있습니다.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 px-6 py-12 text-sm text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              알림을 불러오는 중입니다...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => {
                  void loadNotifications();
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                다시 시도
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">
              표시할 알림이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {items.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    void handleNotificationClick(notification);
                  }}
                  className="flex w-full items-start justify-between gap-4 px-6 py-4 text-left transition hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-gray-900">{notification.title}</h3>
                      {!notification.isRead && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{notification.message || '내용이 없는 알림입니다.'}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">{toRelativeTimeLabel(notification.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
