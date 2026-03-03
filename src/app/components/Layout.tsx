import { Link, useLocation, useNavigate } from 'react-router';
import { Home, AlertCircle, Car, Calendar, Settings, Bell, Menu, TrendingUp, X, AlertTriangle, Shield, FileText, Signal, DollarSign, AlertOctagon, Wrench, Clock, Sparkles, LogOut, User, Building2, Trash2, ChevronDown, Zap, LifeBuoy } from 'lucide-react';
import { ReactNode, useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAuthorization } from '../context/AuthorizationContext';
import { useCompany } from '../context/CompanyContext';
import { resolveRoutePermissionForPath, ROUTE_PERMISSIONS } from '../authorization';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

interface Notification {
  id: string;
  type: 'urgent' | 'warning' | 'info';
  icon: any;
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  link: string;
}

export function Layout({ children, title }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { canAccessRoute } = useAuthorization();
  const { company, isLoading: isCompanyLoading, isUpdating: isCompanyUpdating, error: companyError, updateCompany } = useCompany();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const accountName = user?.name?.trim() || user?.userId?.trim() || user?.email?.trim() || '사용자';
  const companyName = company?.name?.trim() || user?.company?.trim() || '회사 정보 없음';
  const [showPremiumBanner, setShowPremiumBanner] = useState(() => {
    const bannerDismissed = sessionStorage.getItem('premiumBannerDismissed');
    return !bannerDismissed;
  });
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'urgent',
      icon: AlertTriangle,
      title: '사고 접수',
      message: '12가3456 차량 사고 발생 - 즉시 확인 필요',
      time: '5분 전',
      isRead: false,
      link: '/action-required?filter=사고 접수'
    },
    {
      id: '2',
      type: 'urgent',
      icon: AlertOctagon,
      title: '도난 의심',
      message: '88라9999 차량 위치 이상 감지',
      time: '15분 전',
      isRead: false,
      link: '/action-required?filter=도난 의심'
    },
    {
      id: '3',
      type: 'warning',
      icon: Clock,
      title: '반납 지연',
      message: '45나7890 차량 반납 시간 2시간 초과',
      time: '1시간 전',
      isRead: false,
      link: '/action-required?filter=반납 지연'
    },
    {
      id: '4',
      type: 'warning',
      icon: Shield,
      title: '보험 만료 임박',
      message: '33다2222 차량 보험 3일 후 만료',
      time: '2시간 전',
      isRead: true,
      link: '/assets'
    },
    {
      id: '5',
      type: 'warning',
      icon: Signal,
      title: '단말 OFF',
      message: '77나7777 차량 GPS 신호 끊김',
      time: '3시간 전',
      isRead: false,
      link: '/action-required?filter=단말 OFF'
    },
    {
      id: '6',
      type: 'info',
      icon: Calendar,
      title: '오늘 대여 시작',
      message: '11가1111 차량 오후 2시 대여 예정',
      time: '4시간 전',
      isRead: true,
      link: '/reservations'
    },
    {
      id: '7',
      type: 'warning',
      icon: DollarSign,
      title: '결제 문제',
      message: '99허9999 고객 카드 결제 실패',
      time: '5시간 전',
      isRead: true,
      link: '/action-required?filter=미납/결제 문제'
    },
    {
      id: '8',
      type: 'info',
      icon: Wrench,
      title: '정기점검 예정',
      message: '22허8888 차량 내일 점검 예정',
      time: '6시간 전',
      isRead: true,
      link: '/action-required?filter=정기점검'
    },
  ]);

  const notificationRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

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

  const handleNotificationClick = (notification: Notification) => {
    setNotifications(prev =>
      prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
    );
    navigateWithRouteGuard(notification.link);
    setShowNotifications(false);
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, isRead: true }))
    );
  };

  const handleDismissBanner = () => {
    setShowPremiumBanner(false);
    sessionStorage.setItem('premiumBannerDismissed', 'true');
  };

  const handleLogout = async () => {
    await logout({ silent: true, redirectToLogin: true });
    setShowAccountMenu(false);
  };

  const handleOpenSettings = () => {
    setShowAccountSettings(true);
    setShowAccountMenu(false);
    setEditName(accountName);
    setEditCompany(companyName);
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

  const handleDeleteAccount = () => {
    if (window.confirm('정말로 계정을 삭제하시겠습니까? 모든 데이터가 삭제되며 복구할 수 없습니다.')) {
      alert('계정이 삭제되었습니다');
      setShowAccountSettings(false);
      setShowDeleteConfirm(false);
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
    { path: '/support-center', label: '고객센터', icon: LifeBuoy, permission: ROUTE_PERMISSIONS.supportCenter },
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
                        onClick={handleMarkAllAsRead}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        모두 읽음
                      </button>
                    )}
                  </div>

                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">알림이 없습니다</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {notifications.map((notification) => {
                          const Icon = notification.icon;
                          return (
                            <div
                              key={notification.id}
                              onClick={() => handleNotificationClick(notification)}
                              className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${
                                notification.isRead ? 'opacity-60' : ''
                              } ${getNotificationColor(notification.type)}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getIconColor(notification.type)}`}>
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
                                    {notification.time}
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
                          navigateWithRouteGuard('/action-required');
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

            {/* 계정 메뉴 */}
            <div className="relative" ref={accountMenuRef}>
              <button
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <div className="w-8 h-8 bg-[#155dfc] rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">{accountName.charAt(0)}</span>
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
                        <span className="text-white text-lg font-semibold">{accountName.charAt(0)}</span>
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
                    <span className="text-white text-2xl font-semibold">{accountName.charAt(0)}</span>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="이름을 입력하세요"
                  />
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
              </div>

              {/* 푸터 */}
              <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  취소
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  삭제
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
                  onClick={() => alert('프리미엄 문의: 1588-XXXX')}
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
