import { Link, useLocation, useNavigate } from 'react-router';
import { Home, AlertCircle, Car, Calendar, Settings, Bell, Menu, TrendingUp, X, AlertTriangle, Shield, Signal, DollarSign, AlertOctagon, Wrench, Clock, Sparkles, LogOut, User, Building2, Trash2, ChevronDown, Zap, Loader2, type LucideIcon } from 'lucide-react';
import { ReactNode, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ApiError } from '../../services/api';
import {
  getNotifications,
  getNotificationSummary,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  NOTIFICATION_STATE_UPDATED_EVENT,
  type NotificationItem,
} from '../../services/notifications';
import { NOTIFICATIONS_ROUTE } from '../../services/notificationNavigation.js';
import { postWithdraw } from '../../services/auth';
import { useAuth } from '../context/AuthContext';
import { useAuthorization } from '../context/AuthorizationContext';
import { useCompany } from '../context/CompanyContext';
import { resolveRoutePermissionForPath, ROUTE_PERMISSIONS } from '../authorization';
import { formatDateKst } from '../utils/dateTimeFormat';
import { navigateToPremiumInquiry } from '../utils/premiumInquiry';

interface LayoutProps {
  children: ReactNode;
  title?: string;
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
  return formatDateKst(parsedDate);
}

function toNotificationErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return '세션이 만료되었습니다. 다시 로그인해 주세요.';
    }
    if (error.status === 403) {
      return '알림 조회 권한이 없습니다.';
    }
    if (error.status === 404) {
      return '알림 API가 아직 준비되지 않았습니다.';
    }
    if (error.status === 405) {
      return '알림 API 메서드가 일치하지 않습니다.';
    }

    const errorCode = typeof error.code === 'string' ? error.code : '';
    if (
      (typeof error.status === 'number' && error.status >= 500)
      || errorCode === 'NETWORK_ERROR'
      || errorCode === 'SERVER_ERROR'
      || errorCode === 'TIMEOUT'
      || errorCode === 'ABORTED'
    ) {
      return '알림 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.';
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '알림을 불러오지 못했습니다. 다시 시도해 주세요.';
}

function getNotificationIcon(notification: NotificationItem): LucideIcon {
  const content = `${notification.title} ${notification.message}`.toLowerCase();

  if (content.includes('사고')) {
    return AlertTriangle;
  }
  if (content.includes('도난')) {
    return AlertOctagon;
  }
  if (content.includes('지연') || content.includes('연체') || content.includes('초과')) {
    return Clock;
  }
  if (content.includes('보험')) {
    return Shield;
  }
  if (content.includes('단말') || content.includes('gps')) {
    return Signal;
  }
  if (content.includes('결제') || content.includes('미납')) {
    return DollarSign;
  }
  if (content.includes('점검') || content.includes('정비')) {
    return Wrench;
  }
  if (content.includes('대여') || content.includes('예약')) {
    return Calendar;
  }

  if (notification.level === 'urgent') {
    return AlertTriangle;
  }
  if (notification.level === 'warning') {
    return AlertCircle;
  }
  return Bell;
}

export function Layout({ children, title }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, viewRole } = useAuth();
  const { canAccessRoute } = useAuthorization();
  const { company, isLoading: isCompanyLoading, isUpdating: isCompanyUpdating, error: companyError, updateCompany } = useCompany();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const companyName = company?.name?.trim() || user?.company?.trim() || '회사 정보 없음';
  const [showPremiumBanner, setShowPremiumBanner] = useState(() => {
    const bannerDismissed = sessionStorage.getItem('premiumBannerDismissed');
    return !bannerDismissed;
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [isNotificationActionPending, setIsNotificationActionPending] = useState(false);
  const canUseNotifications = viewRole !== 'device-installer';

  const notificationRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const accountName = useMemo(() => {
    const displayName = user?.name?.trim();
    if (displayName) {
      return displayName;
    }
    const userId = user?.userId?.trim();
    if (userId) {
      return userId;
    }
    const email = user?.email?.trim();
    if (email) {
      return email;
    }
    return '사용자';
  }, [user?.name, user?.userId, user?.email]);
  const accountNameInitial = accountName.charAt(0) || '?';

  const loadNotificationState = useCallback(async (signal?: AbortSignal) => {
    if (!canUseNotifications) {
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsError(null);
      setIsNotificationsLoading(false);
      return;
    }

    setIsNotificationsLoading(true);
    setNotificationsError(null);

    const [listResult, summaryResult] = await Promise.allSettled([
      getNotifications({ page: 1, pageSize: 30, signal }),
      getNotificationSummary({ signal }),
    ]);

    if (signal?.aborted) {
      return;
    }

    if (listResult.status === 'fulfilled') {
      setNotifications(listResult.value.items);
    } else {
      setNotifications([]);
    }

    if (summaryResult.status === 'fulfilled') {
      setUnreadCount(summaryResult.value.unreadCount);
    } else if (listResult.status === 'fulfilled') {
      setUnreadCount(listResult.value.unreadCount);
    } else {
      setUnreadCount(0);
    }

    if (listResult.status === 'rejected') {
      setNotificationsError(toNotificationErrorMessage(listResult.reason));
    } else {
      setNotificationsError(null);
    }

    setIsNotificationsLoading(false);
  }, [canUseNotifications]);

  useEffect(() => {
    const controller = new AbortController();
    void loadNotificationState(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadNotificationState]);

  useEffect(() => {
    if (!canUseNotifications) {
      setShowNotifications(false);
      return undefined;
    }
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleNotificationStateUpdated = () => {
      void loadNotificationState();
    };

    window.addEventListener(NOTIFICATION_STATE_UPDATED_EVENT, handleNotificationStateUpdated);
    return () => {
      window.removeEventListener(NOTIFICATION_STATE_UPDATED_EVENT, handleNotificationStateUpdated);
    };
  }, [canUseNotifications, loadNotificationState]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    };

    if (showNotifications || showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications, showAccountMenu]);

  const navigateWithRouteGuard = (path: string) => {
    const routePermission = resolveRoutePermissionForPath(path);
    if (routePermission && !canAccessRoute(routePermission)) {
      navigate('/forbidden');
      return;
    }
    navigate(path);
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    const previousUnreadCount = unreadCount;
    const shouldMarkAsRead = !notification.isRead;

    if (shouldMarkAsRead) {
      setNotifications((previousNotifications) => (
        previousNotifications.map((entry) => (
          entry.id === notification.id ? { ...entry, isRead: true } : entry
        ))
      ));
      setUnreadCount((previousCount) => Math.max(0, previousCount - 1));
    }

    navigateWithRouteGuard(notification.path);
    setShowNotifications(false);

    if (!shouldMarkAsRead) {
      return;
    }

    try {
      await markNotificationAsRead(notification.id);
      void loadNotificationState();
    } catch (error) {
      setNotifications((previousNotifications) => (
        previousNotifications.map((entry) => (
          entry.id === notification.id ? { ...entry, isRead: false } : entry
        ))
      ));
      setUnreadCount(previousUnreadCount);
      setNotificationsError(toNotificationErrorMessage(error));
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount <= 0 || isNotificationActionPending) {
      return;
    }

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setIsNotificationActionPending(true);
    setNotifications((previousNotificationsState) => (
      previousNotificationsState.map((entry) => ({ ...entry, isRead: true }))
    ));
    setUnreadCount(0);

    try {
      await markAllNotificationsAsRead();
      setNotificationsError(null);
      void loadNotificationState();
    } catch (error) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      setNotificationsError(toNotificationErrorMessage(error));
    } finally {
      setIsNotificationActionPending(false);
    }
  };

  const handleRetryNotifications = () => {
    void loadNotificationState();
  };

  const handleDismissBanner = () => {
    setShowPremiumBanner(false);
    sessionStorage.setItem('premiumBannerDismissed', 'true');
  };

  const handlePremiumBannerClick = useCallback(() => {
    navigateToPremiumInquiry(navigate, 'layout-banner');
  }, [navigate]);

  const handleLogout = async () => {
    await logout({ silent: true, redirectToLogin: true });
    setShowAccountMenu(false);
  };

  const handleOpenSettings = () => {
    setShowAccountSettings(true);
    setShowAccountMenu(false);
    setEditName(accountName);
    setEditCompany(companyName);
    setDeleteAccountError(null);
  };

  const handleSaveSettings = async () => {
    const trimmedCompany = editCompany.trim();

    if (trimmedCompany && trimmedCompany !== companyName) {
      try {
        await updateCompany({ name: trimmedCompany });
      } catch {
        return;
      }
    }

    setShowAccountSettings(false);
    alert('계정 정보가 저장되었습니다');
  };

  const handleDeleteAccount = async () => {
    setDeleteAccountError(null);
    setIsDeletingAccount(true);

    try {
      await postWithdraw();
      setShowAccountSettings(false);
      setShowDeleteConfirm(false);
      await logout({ silent: true, redirectToLogin: true });
    } catch (error) {
      if (error instanceof ApiError && error.message) {
        setDeleteAccountError(error.message);
      } else if (error instanceof Error && error.message) {
        setDeleteAccountError(error.message);
      } else {
        setDeleteAccountError('계정 삭제를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'urgent':
        return 'border-l-red-500 bg-red-50';
      case 'warning':
        return 'border-l-orange-500 bg-orange-50';
      case 'info':
        return 'border-l-blue-500 bg-blue-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'urgent':
        return 'text-red-600 bg-red-100';
      case 'warning':
        return 'text-orange-600 bg-orange-100';
      case 'info':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const menuItems = [
    { path: '/', label: '홈', icon: Home, permission: ROUTE_PERMISSIONS.home },
    { path: '/action-required', label: '조치 필요 항목', icon: AlertCircle, permission: ROUTE_PERMISSIONS.actionRequired },
    { path: '/assets', label: '차량 자산', icon: Car, permission: ROUTE_PERMISSIONS.assets },
    { path: '/reservations', label: '대여 예약', icon: Calendar, permission: ROUTE_PERMISSIONS.reservations },
    { path: '/revenue', label: '매출 요약', icon: TrendingUp, permission: ROUTE_PERMISSIONS.revenue },
{ path: '/device-installation', label: '단말 장착/관리', icon: Zap, permission: ROUTE_PERMISSIONS.deviceInstallation },
    { path: '/settings', label: '설정', icon: Settings, permission: ROUTE_PERMISSIONS.settings },
  ];

  const filteredMenuItems = menuItems.filter((item) => canAccessRoute(item.permission));

  return (
    <div className="flex h-screen bg-[#F7F8FA]">
      {/* Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-[80px]' : 'w-[240px]'} bg-[#1e3a8a] flex flex-col shrink-0 transition-all duration-300`}>
        <div className="h-14 flex items-center justify-between px-6 border-b border-[#1447e6]">
          <h1 className="text-white text-xl font-bold overflow-hidden">
            {isSidebarCollapsed ? 'P' : 'Pangea'}
          </h1>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="text-white p-2 hover:bg-white/10 rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 pt-6">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 ${isSidebarCollapsed ? 'px-4 justify-center' : 'px-6'} py-3 text-white transition-colors ${
                  isActive 
                    ? 'bg-[#1447e6] border-r-4 border-white' 
                    : 'hover:bg-white/10'
                }`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span className="text-base">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-[#e5e7eb] flex items-center justify-between px-6 shrink-0">
          {title && (
            <h1 className="text-xl font-bold text-[#1e2939]">{title}</h1>
          )}
          {!title && <div />}
          <div className="flex items-center gap-4">
            {/* 알림 버튼 */}
            {canUseNotifications && (
              <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5 text-[#4A5565]" />
                {unreadCount > 0 && (
                  <>
                    <span className="absolute top-1 right-1 w-2 h-2 bg-[#fb2c36] rounded-full"></span>
                    <span className="absolute -top-1 -right-1 bg-[#fb2c36] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount}
                    </span>
                  </>
                )}
              </button>

              {/* 알림 드롭다운 */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[600px] overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">알림</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        읽지 않은 알림 {unreadCount}개
                      </p>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => {
                          void handleMarkAllAsRead();
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-60"
                        disabled={isNotificationActionPending}
                      >
                        {isNotificationActionPending ? '처리 중...' : '모두 읽음'}
                      </button>
                    )}
                  </div>

                  <div className="overflow-y-auto flex-1">
                    {isNotificationsLoading ? (
                      <div className="p-8 text-center">
                        <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-3 animate-spin" />
                        <p className="text-sm text-gray-500">알림을 불러오는 중입니다...</p>
                      </div>
                    ) : notificationsError && notifications.length === 0 ? (
                      <div className="p-6 text-center space-y-3">
                        <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
                        <p className="text-sm text-red-600">{notificationsError}</p>
                        <button
                          onClick={handleRetryNotifications}
                          className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          다시 시도
                        </button>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">알림이 없습니다</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {notificationsError && (
                          <div className="mx-3 my-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs text-amber-700">{notificationsError}</p>
                              <button
                                onClick={handleRetryNotifications}
                                className="text-xs font-medium text-amber-700 hover:text-amber-800"
                              >
                                새로고침
                              </button>
                            </div>
                          </div>
                        )}
                        {notifications.map((notification) => {
                          const Icon = getNotificationIcon(notification);
                          return (
                            <div
                              key={notification.id}
                              onClick={() => {
                                void handleNotificationClick(notification);
                              }}
                              className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${
                                notification.isRead ? 'opacity-60' : ''
                              } ${getNotificationColor(notification.level)}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getIconColor(notification.level)}`}>
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <h4 className="text-sm font-bold text-gray-900 truncate">
                                      {notification.title}
                                    </h4>
                                    {!notification.isRead && (
                                      <div className="w-2 h-2 bg-blue-600 rounded-full shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 mb-1.5">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {toRelativeTimeLabel(notification.createdAt)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {notifications.length > 0 && (
                    <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                      <button
                        onClick={() => {
                          navigateWithRouteGuard(NOTIFICATIONS_ROUTE);
                          setShowNotifications(false);
                        }}
                        className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        모든 알림 보기
                      </button>
                    </div>
                  )}
                </div>
              )}
              </div>
            )}

            {/* 계정 메뉴 */}
            <div className="relative" ref={accountMenuRef}>
              <button
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <div className="w-8 h-8 bg-[#155dfc] rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">{accountNameInitial}</span>
                </div>
                <span className="text-sm text-[#0a0a0a]">{accountName}</span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>

              {/* 계정 드롭다운 */}
              {showAccountMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                  {/* 계정 정보 */}
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#155dfc] rounded-full flex items-center justify-center">
                        <span className="text-white text-lg font-semibold">{accountNameInitial}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 truncate">{accountName}</h4>
                        <p className="text-xs text-gray-600">{isCompanyLoading ? '회사 정보 확인 중...' : companyName}</p>
                      </div>
                    </div>
                  </div>

                  {/* 메뉴 항목 */}
                  <div className="py-2">
                    <button
                      onClick={handleOpenSettings}
                      className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-900">계정 설정</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-900">로그아웃</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 계정 설정 모달 */}
        {showAccountSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md m-4">
              {/* 헤더 */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">계정 설정</h2>
                <button
                  onClick={() => setShowAccountSettings(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* 내용 */}
              <div className="p-6 space-y-6">
                {/* 프로필 이미지 */}
                <div className="flex justify-center">
                  <div className="w-20 h-20 bg-[#155dfc] rounded-full flex items-center justify-center">
                    <span className="text-white text-2xl font-semibold">{accountNameInitial}</span>
                  </div>
                </div>

                {/* 이름 변경 */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <User className="w-4 h-4" />
                    이름
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder="이름을 입력하세요"
                    disabled
                  />
                  <p className="mt-2 text-xs text-gray-500">이름은 로그인 계정 정보와 자동 동기화됩니다.</p>
                </div>

                {/* 소속 회사 */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <Building2 className="w-4 h-4" />
                    소속 회사
                  </label>
                  <input
                    type="text"
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder="회사명을 입력하세요"
                    disabled={isCompanyUpdating}
                  />
                  {companyError && <p className="mt-2 text-xs text-red-600">{companyError}</p>}
                </div>

                {/* 위험 영역 */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-semibold text-red-600 mb-3">위험 영역</h3>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    계정 삭제
                  </button>
                </div>
              </div>

              {/* 푸터 */}
              <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowAccountSettings(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-60"
                  disabled={isCompanyUpdating}
                >
                  취소
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-60"
                  disabled={isCompanyUpdating}
                >
                  {isCompanyUpdating ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 계정 삭제 확인 모달 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm m-4">
              {/* 헤더 */}
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-red-600">계정 삭제 확인</h2>
              </div>

              {/* 내용 */}
              <div className="p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <Trash2 className="w-8 h-8 text-red-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-700 text-center mb-2">
                  정말로 계정을 삭제하시겠습니까?
                </p>
                <p className="text-xs text-gray-500 text-center">
                  모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
                </p>
                {deleteAccountError && (
                  <p className="mt-3 text-center text-xs text-red-600">{deleteAccountError}</p>
                )}
              </div>

              {/* 푸터 */}
              <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-60"
                  disabled={isDeletingAccount}
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    void handleDeleteAccount();
                  }}
                  data-testid="account-delete-confirm"
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-60"
                  disabled={isDeletingAccount}
                >
                  {isDeletingAccount ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {/* 프리미엄 업그레이드 배너 */}
          {showPremiumBanner && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 flex items-center justify-between relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 transform -skew-x-12"></div>
              
              <div className="relative z-10 flex items-center gap-4 flex-1">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">🚨 사고/도난 발생 전 예방하세요!</p>
                  <p className="text-xs opacity-90">단말 설치로 차량 실시간 모니터링 · 위치 이상 감지 즉시 알림 · 연간 수백만원 손실 방지</p>
                </div>
              </div>
              
              <div className="relative z-10 flex items-center gap-3">
                <button
                  onClick={handlePremiumBannerClick}
                  className="px-5 py-2 bg-white text-blue-600 font-bold rounded-lg hover:bg-gray-100 transition-colors"
                >
                  자세히 보기
                </button>
                <button
                  onClick={handleDismissBanner}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
          
          {children}
        </main>
      </div>
    </div>
  );
}
