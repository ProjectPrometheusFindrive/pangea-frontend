import { Layout } from '../components/Layout';
import { Clock, Car, FileText, TrendingUp, AlertCircle, Calendar, DollarSign, Lock, Sparkles, AlertOctagon, Signal, Wrench, Shield, AlertTriangle, MessageSquare, ClipboardCheck } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate } from 'react-router';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageStateBoundary } from '../components/PageStateBoundary';
import {
  getPageErrorActionLabel,
  handlePageErrorAction,
  isPayloadEmpty,
  usePageEndpointState,
} from '../hooks/usePageEndpointState';
import { usePaymentStatusSync } from '../hooks/usePaymentStatusSync';
import { vehicleAssets, reservations, actionItems, getTodayStats } from '../data/mockData';
import { isUnpaidPaymentStatus, toCanonicalPaymentStatus } from '../utils/paymentStatusSync';
import { getHomeSummaryDashboard } from '../../services/dashboard';

export default function Home() {
  const navigate = useNavigate();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const {
    isLoading: isHomeLoading,
    error: homeError,
    errorKind: homeErrorKind,
    isEmpty: isHomeApiEmpty,
    run: hydrateHomeSummary,
  } = usePageEndpointState<unknown>({
    request: (signal) => getHomeSummaryDashboard({ signal }),
    isEmpty: (payload) => isPayloadEmpty(payload, ['summary', 'stats', 'items', 'cards']),
  });

  useEffect(() => {
    void hydrateHomeSummary();
  }, []);

  const handleHomeRetry = useCallback(() => {
    void hydrateHomeSummary();
  }, [hydrateHomeSummary]);

  const handleHomeErrorAction = useCallback(() => {
    handlePageErrorAction(homeErrorKind, navigate);
  }, [homeErrorKind, navigate]);

  const paymentSyncTargets = useMemo(() => (
    reservations.map((reservation) => ({
      reservationId: reservation.id,
      fallbackStatus: reservation.paymentStatus,
    }))
  ), []);

  const {
    byReservationId: syncedPaymentByReservationId,
    isSyncing: isPaymentSyncing,
    error: paymentSyncError,
    usingLastKnown: isPaymentSyncUsingLastKnown,
    retry: retryPaymentSync,
  } = usePaymentStatusSync({
    targets: paymentSyncTargets,
    enabled: paymentSyncTargets.length > 0,
    pollIntervalMs: 20_000,
  });

  const unpaidFromPayments = useMemo(() => (
    paymentSyncTargets.reduce((count, target) => {
      if (!target.reservationId) {
        return count;
      }
      const syncedPaymentStatus = syncedPaymentByReservationId[target.reservationId];
      if (syncedPaymentStatus) {
        return isUnpaidPaymentStatus(syncedPaymentStatus.status) ? count + 1 : count;
      }
      if (!target.fallbackStatus) {
        return count;
      }
      return isUnpaidPaymentStatus(toCanonicalPaymentStatus(target.fallbackStatus)) ? count + 1 : count;
    }, 0)
  ), [paymentSyncTargets, syncedPaymentByReservationId]);
  
  // 오늘 할 일 통계
  const todayStats = getTodayStats();
  
  // 실제 데이터 기반 조치 필요 항목 카테고리별 수 계산
  const actionCounts = useMemo(() => {
    // mockData.ts의 actionItems에서 각 카테고리별 개수 계산
    const returnDelayCount = actionItems.filter(item => item.category === '반납 지연').length;
    const accidentCount = actionItems.filter(item => item.category === '사고 접수').length;
    const terminalOffCount = actionItems.filter(item => item.category === '단말 OFF').length;
    const theftCount = actionItems.filter(item => item.category === '도난 의심').length;
    const malfunctionCount = actionItems.filter(item => item.category === '차량이상').length;
    const maintenanceCount = actionItems.filter(item => item.category === '정기점검').length;
    const insuranceCount = actionItems.filter(item => item.category === '보험 만료 임박').length;
    
    // 미납/결제 문제는 actionItems + 결제 상태 동기화 결과를 합산
    const unpaidFromActionItems = actionItems.filter(item => item.category === '미납/결제 문제').length;
    const totalUnpaidCount = unpaidFromActionItems + unpaidFromPayments;
    
    return [
      { category: '반납 지연', count: returnDelayCount },
      { category: '차량이상', count: malfunctionCount },
      { category: '보험 만료 임박', count: insuranceCount },
      { category: '정기점검', count: maintenanceCount },
      { category: '미납/결제 문제', count: totalUnpaidCount },
      { category: '사고 접수', count: accidentCount },
      { category: '도난 의심', count: theftCount },
      { category: '단말 OFF', count: terminalOffCount },
    ];
  }, [unpaidFromPayments]);
  
  // 홈 화면용 상태이상 카드
  const actionItemsForHome = useMemo(() => {
    return [
      { 
        label: '반납 지연', 
        count: actionCounts.find(c => c.category === '반납 지연')?.count || 0,
        bg: 'bg-red-50',
        color: 'text-red-600',
        icon: 'AlertCircle',
        filter: '반납 지연',
        isPremium: false
      },
      { 
        label: '미납/결제 문제', 
        count: actionCounts.find(c => c.category === '미납/결제 문제')?.count || 0,
        bg: 'bg-yellow-50',
        color: 'text-yellow-600',
        icon: 'DollarSign',
        filter: '미납/결제 문제',
        isPremium: false
      },
      { 
        label: '보험 만료 임박', 
        count: actionCounts.find(c => c.category === '보험 만료 임박')?.count || 0,
        bg: 'bg-blue-50',
        color: 'text-blue-600',
        icon: 'Shield',
        filter: '보험 만료 임박',
        isPremium: false
      },
      { 
        label: '점검 만료 임박', 
        count: actionCounts.find(c => c.category === '정기점검')?.count || 0,
        bg: 'bg-blue-50',
        color: 'text-blue-600',
        icon: 'ClipboardCheck',
        filter: '정기점검',
        isPremium: false
      },
      { 
        label: '사고 접수', 
        count: actionCounts.find(c => c.category === '사고 접수')?.count || 0,
        bg: 'bg-red-50',
        color: 'text-red-600',
        icon: 'AlertTriangle',
        filter: '사고 접수',
        isPremium: false
      },
      { 
        label: '차량이상', 
        count: actionCounts.find(c => c.category === '차량이상')?.count || 0,
        bg: 'bg-orange-50',
        color: 'text-orange-600',
        icon: 'Wrench',
        filter: '차량이상',
        isPremium: true,
        description: '단말 장착 차량만'
      },
      { 
        label: '단말 OFF', 
        count: actionCounts.find(c => c.category === '단말 OFF')?.count || 0,
        bg: 'bg-orange-50',
        color: 'text-orange-600',
        icon: 'Signal',
        filter: '단말 OFF',
        isPremium: true,
        description: '단말 장착 차량만'
      },
      { 
        label: '도난 의심', 
        count: actionCounts.find(c => c.category === '도난 의심')?.count || 0,
        bg: 'bg-purple-50',
        color: 'text-purple-600',
        icon: 'AlertOctagon',
        filter: '도난 의심',
        isPremium: true,
        description: '단말 장착 차량만'
      },
    ];
  }, [actionCounts]);

  // 아이콘 매핑
  const iconMap: Record<string, any> = {
    Car,
    Calendar,
    FileText,
    Clock,
    AlertCircle,
    Wrench,
    Shield,
    AlertTriangle,
    MessageSquare,
    AlertOctagon,
    ClipboardCheck,
    DollarSign,
    Signal,
  };

  // 자산 현황 데이터 - vehicleAssets에서 동적으로 계산
  const assetData = useMemo(() => {
    const rentalCount = vehicleAssets.filter(v => v.status === '대여중').length;
    const reservedCount = vehicleAssets.filter(v => v.status === '예약').length;
    const availableCount = vehicleAssets.filter(v => v.status === '가용').length;
    const maintenanceCount = vehicleAssets.filter(v => v.status === '정비중').length;
    
    return [
      { name: '대여중', value: rentalCount, color: '#1e3a8a', status: '대여중' },
      { name: '예약', value: reservedCount, color: '#60a5fa', status: '예약' },
      { name: '가용', value: availableCount, color: '#22c55e', status: '가용' },
      { name: '정비', value: maintenanceCount, color: '#f59e0b', status: '정비중' },
    ];
  }, []);

  // 계약 현황 데이터 - reservations에서 동적으로 계산
  const contractData = useMemo(() => {
    const rentalCount = reservations.filter(r => r.type === 'rental').length;
    const reservationCount = reservations.filter(r => r.type === 'reservation').length;
    const unpaidCount = actionCounts.find(c => c.category === '미납/결제 문제')?.count || 0;
    const returnedCount = reservations.filter(r => r.type === 'return').length;
    
    return [
      { name: '대여중', value: rentalCount, color: '#1e3a8a', status: 'rental' },
      { name: '예약', value: reservationCount, color: '#8b5cf6', status: 'reservation' },
      { name: '미납중', value: unpaidCount, color: '#ef4444', status: 'unpaid' },
      { name: '반납완료', value: returnedCount, color: '#22c55e', status: 'returned' },
    ];
  }, [actionCounts]);

  // 운영 점수 데이터
  const operationScores = [
    { label: '안전운전', score: 87, color: 'bg-green-500' },
    { label: '차량관리', score: 68, color: 'bg-orange-500' },
    { label: '사업운영', score: 75, color: 'bg-blue-500' },
  ];

  const handleTaskClick = (filter: string) => {
    navigate(`/reservations?filter=${filter}`);
  };

  const handleIssueClick = (filter: string) => {
    navigate(`/action-required?filter=${encodeURIComponent(filter)}`);
  };

  const handleAssetClick = (status: string) => {
    navigate(`/assets?status=${encodeURIComponent(status)}`);
  };

  const handleContractClick = (status: string) => {
    navigate(`/reservations?filter=${status}`);
  };

  // 커스텀 Tooltip 컴포넌트
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-bold text-gray-900 mb-1">{data.name}</p>
          <p className="text-lg font-bold" style={{ color: data.payload.color }}>
            {data.value}{data.payload.status ? (data.name === '반납완료' || data.name.includes('대여') || data.name === '예약' || data.name === '미납중' ? '건' : '대') : '대'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            클릭하여 상세보기
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Layout title="홈">
      <PageStateBoundary
        isLoading={isHomeLoading}
        error={homeError}
        isEmpty={isHomeApiEmpty}
        errorDescription="홈 요약 데이터를 불러오는 중 문제가 발생했습니다."
        emptyTitle="표시할 홈 요약 데이터가 없습니다"
        emptyDescription="요약 데이터가 준비되면 자동으로 표시됩니다."
        onRetry={handleHomeRetry}
        errorActionLabel={getPageErrorActionLabel(homeErrorKind)}
        onErrorAction={handleHomeErrorAction}
        emptyActionLabel="다시 불러오기"
        onEmptyAction={handleHomeRetry}
        className="m-6 min-h-[320px]"
      >
        <div className="p-6 space-y-5">
        {(paymentSyncError || isPaymentSyncing) && (
          <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${
            paymentSyncError
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}>
            <span>
              {paymentSyncError
                ? (
                  isPaymentSyncUsingLastKnown
                    ? '결제 상태 동기화에 실패해 마지막 정상 상태를 표시 중입니다.'
                    : paymentSyncError
                )
                : '결제 상태를 동기화하는 중입니다.'}
            </span>
            {paymentSyncError && (
              <button
                type="button"
                onClick={retryPaymentSync}
                className="rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-700 hover:bg-amber-100"
              >
                다시 시도
              </button>
            )}
          </div>
        )}
        {/* 오늘 할 일 & 상태이상 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-bold text-[#1e2939] mb-3">오늘 할 일</h2>
          
          <div className="grid grid-cols-[340px_1fr] gap-4">
            {/* 좌측: 예약/대여/반납 3개 지표 */}
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
              {todayStats.map((task, index) => {
                const Icon = iconMap[task.icon];
                return (
                  <div
                    key={index}
                    onClick={() => handleTaskClick(task.filter)}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                        <Icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-[#4a5565]">{task.label}</p>
                        <p className="text-2xl font-bold text-[#101828] mt-0.5">{task.count}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 우측: 상태이상 8개 항목 (2행 x 4열) */}
            <div className="grid grid-cols-4 gap-3">
              {actionItemsForHome.map((issue, index) => {
                const Icon = iconMap[issue.icon];
                
                // 단말 설치 필요 기능인 경우
                if (issue.isPremium) {
                  return (
                    <div
                      key={index}
                      onClick={() => setShowPremiumModal(true)}
                      className={`${issue.bg} rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow relative`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className={`w-8 h-8 bg-white rounded-lg flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 ${issue.color}`} />
                        </div>
                        <Lock className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <p className="text-2xl font-bold text-[#101828] mb-0.5">{issue.count}</p>
                      <p className="text-xs text-[#4a5565] mb-1">{issue.label}</p>
                      <p className="text-[10px] text-gray-500 leading-tight">{issue.description}</p>
                    </div>
                  );
                }
                
                return (
                  <div
                    key={index}
                    onClick={() => handleIssueClick(issue.filter)}
                    className={`${issue.bg} rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className={`w-8 h-8 bg-white rounded-lg flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${issue.color}`} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-[#101828] mb-0.5">{issue.count}</p>
                    <p className="text-xs text-[#4a5565]">{issue.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 운영 대시보드 섹션 */}
        <div>
          <h2 className="text-xl font-bold text-[#1e2939] mb-3">운영 대시보드</h2>
          
          <div className="grid grid-cols-3 gap-4">
            {/* 자산 현황 */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[#1e2939] mb-3">자산 현황</h3>
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={assetData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      onClick={(data) => handleAssetClick(data.status)}
                      className="cursor-pointer"
                    >
                      {assetData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* 클릭 가능한 범례 */}
                <div className="grid grid-cols-2 gap-2 mt-3 w-full">
                  {assetData.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => handleAssetClick(item.status)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-gray-700 font-medium">{item.name}</span>
                      <span className="text-xs text-gray-500 ml-auto">{item.value}대</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 계약 현황 */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[#1e2939] mb-3">계약 현황</h3>
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={contractData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      onClick={(data) => handleContractClick(data.status)}
                      className="cursor-pointer"
                    >
                      {contractData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* 클릭 가능한 범례 */}
                <div className="grid grid-cols-2 gap-2 mt-3 w-full">
                  {contractData.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => handleContractClick(item.status)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-gray-700 font-medium">{item.name}</span>
                      <span className="text-xs text-gray-500 ml-auto">{item.value}건</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 운영 점수 */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[#1e2939] mb-3">운영 점수</h3>
              <div className="space-y-5 mt-6">
                {operationScores.map((item, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[#4a5565]">{item.label}</span>
                      <span className="text-base font-bold text-[#1e2939]">{item.score}점</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`${item.color} h-2 rounded-full transition-all`}
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 프리미엄 미리보기 섹션 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 relative overflow-hidden">
          {/* 배경 장식 */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-200 rounded-full opacity-20 blur-3xl -mr-32 -mt-32"></div>
          
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-6 h-6 text-blue-600" />
                  <h3 className="text-xl font-bold text-[#1e2939]">실시간 차량 모니터링</h3>
                  <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-full">
                    PREMIUM
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  지금 <span className="font-bold text-blue-600">12대 차량</span>을 실시간으로 추적할 수 있습니다
                </p>
              </div>
              <button
                onClick={() => setShowPremiumModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg hover:shadow-lg transition-shadow"
              >
                프리미엄 시작하기
              </button>
            </div>

            {/* 프리미엄 기능 미리보기 (흐리게) */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white rounded-lg p-4 relative">
                <div className="absolute inset-0 backdrop-blur-sm bg-white/50 rounded-lg"></div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertOctagon className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">도난 의심 알림</p>
                    <p className="text-xl font-bold text-gray-900">실시간 감지</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">차량 위치 이상 즉시 알림</p>
              </div>

              <div className="bg-white rounded-lg p-4 relative">
                <div className="absolute inset-0 backdrop-blur-sm bg-white/50 rounded-lg"></div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Signal className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">단말 상태 모니터링</p>
                    <p className="text-xl font-bold text-gray-900">24/7 추적</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">GPS 신호 끊김 즉시 확인</p>
              </div>

              <div className="bg-white rounded-lg p-4 relative">
                <div className="absolute inset-0 backdrop-blur-sm bg-white/50 rounded-lg"></div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Wrench className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">차량 이상 감지</p>
                    <p className="text-xl font-bold text-gray-900">사전 예방</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">고장 전 미리 파악</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </PageStateBoundary>

      {/* 프리미엄 모달 */}
      {showPremiumModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPremiumModal(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 relative" onClick={(e) => e.stopPropagation()}>
            {/* 닫기 버튼 */}
            <button
              onClick={() => setShowPremiumModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
            >
              ×
            </button>

            {/* 헤더 */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-[#1e2939] mb-2">프리미엄으로 업그레이드</h2>
              <p className="text-gray-600">단말 설치로 차량을 실시간으로 모니터링하세요</p>
            </div>

            {/* 기능 리스트 */}
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-4 p-4 bg-red-50 rounded-lg">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                  <AlertOctagon className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">도난 의심 실시간 알림</h3>
                  <p className="text-sm text-gray-600">차량 위치 이상 감지 시 즉시 알림을 받아 피해를 최소화하세요</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-orange-50 rounded-lg">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                  <Signal className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">단말 OFF 모니터링</h3>
                  <p className="text-sm text-gray-600">GPS 신호 끊김을 즉시 확인하여 차량 추적 손실을 방지하세요</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-orange-50 rounded-lg">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                  <Wrench className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">차량 이상 사전 감지</h3>
                  <p className="text-sm text-gray-600">고장이 발생하기 전에 미리 파악하여 정비 비용을 절감하세요</p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowPremiumModal(false)}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
              >
                나중에
              </button>
              <button
                onClick={() => {
                  setShowPremiumModal(false);
                  // 실제로는 프리미엄 가입 페이지로 이동
                  alert('프리미엄 문의: 1588-XXXX');
                }}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg hover:shadow-lg transition-shadow"
              >
                지금 시작하기
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
