import { Layout } from '../components/Layout';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, Plus, ArrowRight, Car, Calendar, AlertCircle, DollarSign, AlertTriangle, X } from 'lucide-react';
import { AccidentReportModal } from '../components/AccidentReportModal';
import { NewContractModal } from '../components/NewContractModal';
import type { AccidentReport } from '../utils/issueUtils';
import { reservations as mockReservations, vehicleAssets as mockVehicleAssets, type Reservation, type VehicleAsset } from '../data/mockData';

// 드래그 선택 타입 정의
type DragSelection = {
  vehicleNumber: string;
  startDate: number;
  endDate: number;
} | null;

export default function Reservations() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [currentWeekStart, setCurrentWeekStart] = useState(0);
  const [viewFilter, setViewFilter] = useState<'all' | 'reservation' | 'rental' | 'return' | 'unpaid'>('all');
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedVehicleAsset, setSelectedVehicleAsset] = useState<VehicleAsset | null>(null);
  const [modelFilter, setModelFilter] = useState('all');
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'reservation' | 'payment' | 'vehicle'>('reservation');
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [showAccidentModal, setShowAccidentModal] = useState(false);
  const [reservationsData, setReservationsData] = useState<Reservation[]>(mockReservations);
  const [targetDate, setTargetDate] = useState('');
  
  // 동적 날짜 로딩을 위한 상태
  const [totalDaysToShow, setTotalDaysToShow] = useState(42); // 초기 6주
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 드래그 선택 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ vehicle: string; date: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ vehicle: string; date: number } | null>(null);
  const [dragSelection, setDragSelection] = useState<DragSelection>(null);

  // URL 파라미터에서 필터 가져오기
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter) {
      setViewFilter(filter as any);
    }
  }, [searchParams]);

  // 가로 스크롤 감지하여 더 많은 날짜 로드
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollLeft = target.scrollLeft;
    const scrollWidth = target.scrollWidth;
    const clientWidth = target.clientWidth;
    
    // 스크롤이 끝에서 200px 이내로 오면 더 많은 날짜 추가
    if (scrollWidth - scrollLeft - clientWidth < 200) {
      setTotalDaysToShow(prev => Math.min(prev + 28, 365)); // 최대 1년까지
    }
  };

  // 차량 목록 - mockVehicleAssets에서 추출
  const vehicles = mockVehicleAssets.map(v => v.vehicleNumber);
  
  // 0 = 월요일, 1 = 화요일, ... 6 = 일요일
  const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];
  const dates = Array.from({ length: totalDaysToShow }, (_, i) => currentWeekStart + i); // 동적으로 날짜 생성

  const reservations: Reservation[] = reservationsData;

  // 차량 자산 정보 - mockData 사용
  const vehicleAssets: VehicleAsset[] = mockVehicleAssets;

  // 고유 차종 목록 추출
  const uniqueModels = Array.from(new Set(vehicleAssets.map(v => v.model))).sort();

  // 먼저 예약 필터링 (상태 필터만 적용)
  const filteredReservations = reservations.filter(res => {
    const today = new Date(2025, 1, 20); // 2025-02-20
    const endDate = new Date(2025, 1, 17 + res.endDate);
    
    // 미납 건 필터링
    if (viewFilter === 'unpaid') {
      return res.issues && res.issues.includes('미납/결제 문제');
    }
    
    // 반납 필터: 오늘 반납 예정이거나 수동으로 반납 처리된 건
    if (viewFilter === 'return') {
      return res.endDateFull === '2025-02-20' || res.type === 'return';
    }
    
    // 대여 필터: 대여중인 건만 (과거 반납 완료 제외)
    if (viewFilter === 'rental') {
      return res.type === 'rental' && endDate >= today;
    }
    
    // 예약 필터
    if (viewFilter === 'reservation') {
      return res.type === 'reservation';
    }
    
    // 전체 보기
    const matchesSearch = searchQuery === '' || 
      res.customer.includes(searchQuery) ||
      res.vehicleNumber.includes(searchQuery);
    return matchesSearch;
  });

  // 차량 필터링 로직 (차종 + 상태 필터 AND 조건)
  const filteredVehicles = vehicles.filter(vehicleNumber => {
    const asset = vehicleAssets.find(a => a.vehicleNumber === vehicleNumber);
    
    // 차종 필터
    const matchesModel = modelFilter === 'all' || (asset && asset.model === modelFilter);
    
    // 차량번호 검색
    const matchesSearch = vehicleSearchQuery === '' || vehicleNumber.includes(vehicleSearchQuery);
    
    // 상태 필터에 따른 차량 필터링 (해당 차량의 예약이 필터 조건에 맞는 경우만)
    if (viewFilter !== 'all') {
      const hasMatchingReservation = filteredReservations.some(res => res.vehicleNumber === vehicleNumber);
      if (!hasMatchingReservation) {
        return false;
      }
    }
    
    return matchesModel && matchesSearch;
  });

  const getBlockColor = (reservation: Reservation) => {
    const today = new Date(2025, 1, 20); // 2025-02-20
    const endDate = new Date(2025, 1, 17 + reservation.endDate);
    
    // 미납 건
    if (reservation.issues && reservation.issues.includes('미납/결제 문제')) {
      return 'bg-red-500';
    }
    
    // 반납 (수동 반납 처리 또는 과거 반납 완료) - 회색 통일
    if (reservation.type === 'return' || endDate < today) {
      return 'bg-gray-400';
    }
    
    // 예약 확정 (미래)
    if (reservation.type === 'reservation') {
      return 'bg-blue-500';
    }
    
    // 대여중
    if (reservation.type === 'rental') {
      return 'bg-green-500';
    }
    
    return 'bg-gray-400';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '가용':
        return 'bg-green-100 text-green-700';
      case '대여중':
        return 'bg-blue-100 text-blue-700';
      case '정비중':
        return 'bg-red-100 text-red-700';
      case '예약됨':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleReservationClick = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    const asset = vehicleAssets.find(a => a.vehicleNumber === reservation.vehicleNumber);
    setSelectedVehicleAsset(asset || null);
    setActiveTab('reservation'); // 탭 초기화
  };

  const handleReturnClick = () => {
    setShowReturnConfirm(true);
  };

  const handleConfirmReturn = () => {
    if (selectedReservation) {
      // 예약 데이터 업데이트
      setReservationsData(prev => 
        prev.map(res => 
          res.id === selectedReservation.id 
            ? { ...res, type: 'return' as const }
            : res
        )
      );
      
      // 선택된 예약 업데이트
      setSelectedReservation({
        ...selectedReservation,
        type: 'return'
      });
      
      setShowReturnConfirm(false);
      
      // 성공 메시지
      setTimeout(() => {
        alert('차량이 반납 처리되었습니다.');
      }, 100);
    }
  };

  const handleAccidentReport = (report: Omit<AccidentReport, 'id'>) => {
    // TODO: DB에 사고 데이터 저장
    console.log('사고 등록:', report);
    
    // 성공 메시지
    alert(`사고가 등록되었습니다.\n차량번호: ${report.vehicleNumber}\n유형: ${report.accidentType}\n담당자: ${report.assignee}`);
    
    // 조치 필요 항목 페이지로 이동
    navigate('/action-required?filter=사고 접수');
  };

  // 드래그 시작 이벤트 핸들러
  const handleDragStart = (vehicle: string, date: number) => {
    setIsDragging(true);
    setDragStart({ vehicle, date });
  };

  // 드래그 종료 이벤트 핸들러
  const handleDragEnd = (vehicle: string, date: number) => {
    setIsDragging(false);
    setDragEnd({ vehicle, date });

    if (dragStart && dragEnd) {
      const startDate = Math.min(dragStart.date, dragEnd.date);
      const endDate = Math.max(dragStart.date, dragEnd.date);
      setDragSelection({ vehicleNumber: vehicle, startDate, endDate });
    }
  };

  return (
    <Layout title="대여 예약">
      <div className="p-4 h-full flex flex-col">
        {/* 필터와 버튼 */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-600">보기:</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setViewFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  viewFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setViewFilter('reservation')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  viewFilter === 'reservation'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                예약
              </button>
              <button
                onClick={() => setViewFilter('rental')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  viewFilter === 'rental'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                대여
              </button>
              <button
                onClick={() => setViewFilter('return')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  viewFilter === 'return'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                반납
              </button>
              <button
                onClick={() => setViewFilter('unpaid')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  viewFilter === 'unpaid'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                미납
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            새 계약 등록
          </button>
        </div>

        {/* 주간 캘린더 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
          {/* 날짜 네비게이션 */}
          <div className="flex items-center gap-3 px-3 py-2 bg-blue-50 border-b border-blue-200 shrink-0">
            <button
              onClick={() => setCurrentWeekStart(prev => prev - 7)}
              className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
              title="1주 이전"
            >
              <ChevronLeft className="w-4 h-4 text-blue-600" />
            </button>
            
            <button
              onClick={() => setCurrentWeekStart(0)}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
            >
              오늘
            </button>
            
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={targetDate}
                onChange={(e) => {
                  setTargetDate(e.target.value);
                  if (e.target.value) {
                    const target = new Date(e.target.value);
                    const base = new Date(2025, 1, 17);
                    const diffDays = Math.floor((target.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
                    setCurrentWeekStart(diffDays);
                  }
                }}
                className="px-3 py-1.5 text-xs border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <span className="text-xs text-blue-600 font-medium">로 이동</span>
            </div>

            <button
              onClick={() => setCurrentWeekStart(prev => prev + 7)}
              className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
              title="1주 이후"
            >
              <ChevronRight className="w-4 h-4 text-blue-600" />
            </button>

            <div className="flex-1" />
            
            <span className="text-xs text-blue-700 font-semibold">
              {new Date(2025, 1, 17 + currentWeekStart).toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} ~
            </span>
          </div>

          {/* 차량 필터 영역 */}
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">차종:</label>
              <select
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">전체</option>
                {uniqueModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">차량번호:</label>
              <input
                type="text"
                placeholder="차량번호 검색"
                value={vehicleSearchQuery}
                onChange={(e) => setVehicleSearchQuery(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
              />
            </div>

            <div className="flex-1" />
            
            <span className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
              💡 캘린더에서 드래그하여 예약을 생성하세요
            </span>
            
            <span className="text-xs text-gray-500">
              총 <span className="font-semibold text-blue-600">{filteredVehicles.length}</span>대 표시 중
            </span>
          </div>
          
          {/* 가로 스크롤 가능한 컨테이너 */}
          <div className="overflow-x-auto flex-1" ref={scrollContainerRef} onScroll={handleScroll}>
            <div style={{ minWidth: `${120 + totalDaysToShow * 85}px` }} className="h-full">
              {/* 날짜 헤더 */}
              <div style={{ display: 'grid', gridTemplateColumns: `120px repeat(${totalDaysToShow}, 1fr)` }} className="border-b border-gray-200">
                <div className="px-3 py-2 bg-gray-50 font-semibold text-sm text-gray-600 border-r border-gray-200 sticky left-0 z-10">
                  차량
                </div>
                {dates.map((dayOffset, index) => {
                  const date = new Date(2025, 1, 17 + dayOffset);
                  const dayOfWeek = daysOfWeek[date.getDay() === 0 ? 6 : date.getDay() - 1];
                  const prevDate = index > 0 ? new Date(2025, 1, 17 + dates[index - 1]) : null;
                  const showMonth = !prevDate || prevDate.getMonth() !== date.getMonth();
                  
                  return (
                    <div
                      key={index}
                      className="px-2 py-2 bg-gray-50 text-center border-r border-gray-200"
                    >
                      {showMonth && (
                        <div className="text-xs font-semibold text-blue-600 mb-0.5">
                          {date.getMonth() + 1}월
                        </div>
                      )}
                      <div className="text-xs text-gray-500">{dayOfWeek}</div>
                      <div className="text-sm font-medium text-gray-900 mt-0.5">
                        {date.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 차량 행 */}
              {filteredVehicles.map((vehicle, vIndex) => (
                <div key={vIndex} className="relative border-b border-gray-200">
                  <div style={{ display: 'grid', gridTemplateColumns: `120px repeat(${totalDaysToShow}, 1fr)` }}>
                    {/* 차량번호 */}
                    <div className="px-3 py-3 bg-gray-50 font-medium text-sm text-gray-900 border-r border-gray-200 flex items-center sticky left-0 z-10">
                      {vehicle}
                    </div>

                    {/* 날짜 셀들 */}
                    {dates.map((dayOffset, dateIndex) => {
                      const cellDate = currentWeekStart + dateIndex;
                      const isInDragSelection = dragStart && dragEnd && 
                        dragStart.vehicle === vehicle &&
                        cellDate >= Math.min(dragStart.date, dragEnd.date) &&
                        cellDate <= Math.max(dragStart.date, dragEnd.date);

                      // 충돌 검증: 이 셀에 기존 예약이 있는지 확인
                      const hasConflict = filteredReservations.some(res => 
                        res.vehicleNumber === vehicle &&
                        cellDate >= res.startDate &&
                        cellDate <= res.endDate
                      );

                      return (
                        <div
                          key={dateIndex}
                          className={`h-14 border-r border-gray-100 relative cursor-crosshair ${
                            isInDragSelection ? (hasConflict ? 'bg-red-200/50' : 'bg-blue-200/50') : 'hover:bg-blue-50/30'
                          }`}
                          onMouseDown={() => {
                            setIsDragging(true);
                            setDragStart({ vehicle, date: cellDate });
                            setDragEnd({ vehicle, date: cellDate });
                            setDragSelection(null);
                          }}
                          onMouseEnter={() => {
                            if (isDragging && dragStart) {
                              setDragEnd({ vehicle, date: cellDate });
                            }
                          }}
                          onMouseUp={() => {
                            if (isDragging && dragStart && dragEnd) {
                              const startDate = Math.min(dragStart.date, dragEnd.date);
                              const endDate = Math.max(dragStart.date, dragEnd.date);
                              
                              // 충돌 검사
                              const conflicts = filteredReservations.filter(res => 
                                res.vehicleNumber === vehicle &&
                                !(endDate < res.startDate || startDate > res.endDate)
                              );

                              if (conflicts.length > 0) {
                                alert(`선택한 기간에 이미 예약이 있습니다.\\n\\n${conflicts.map(c => `${c.customer}: ${c.startDateFull} ~ ${c.endDateFull}`).join('\\n')}`);
                              } else {
                                setDragSelection({ vehicleNumber: vehicle, startDate, endDate });
                                setShowModal(true);
                              }
                            }
                            setIsDragging(false);
                            setDragStart(null);
                            setDragEnd(null);
                          }}
                        >
                        </div>
                      );
                    })}
                  </div>

                  {/* 예약 블록 오버레이 - absolute로 전체 행 위에 배치 */}
                  <div className="absolute inset-0 left-[120px] pointer-events-none">
                    {filteredReservations
                      .filter(res => res.vehicleNumber === vehicle)
                      .filter(res => {
                        // 현재 보이는 범위와 겹치는 예약만 표시
                        const viewEnd = currentWeekStart + totalDaysToShow - 1;
                        return !(res.endDate < currentWeekStart || res.startDate > viewEnd);
                      })
                      .map(res => {
                        // 블록의 시작 위치 계산 (현재 뷰 기준)
                        const blockStart = Math.max(res.startDate, currentWeekStart);
                        const blockEnd = Math.min(res.endDate, currentWeekStart + totalDaysToShow - 1);
                        const startIndex = blockStart - currentWeekStart;
                        const duration = blockEnd - blockStart + 1;
                        
                        // 셀 너비 계산
                        const cellWidth = 100 / totalDaysToShow;
                        const left = startIndex * cellWidth;
                        const width = duration * cellWidth;
                        
                        const isHighlighted = searchQuery && res.customer.includes(searchQuery);
                        
                        return (
                          <div
                            key={res.id}
                            onClick={() => handleReservationClick(res)}
                            className={`absolute top-1.5 h-11 ${getBlockColor(res)} rounded px-2 py-1 text-white text-xs flex flex-col justify-between cursor-pointer hover:opacity-90 transition-opacity pointer-events-auto ${
                              isHighlighted ? 'ring-4 ring-yellow-400' : ''
                            }`}
                            style={{
                              left: `${left}%`,
                              width: `${width}%`,
                            }}
                          >
                            <span className="font-medium truncate">{res.customer}</span>
                            {res.issues && res.issues.length > 0 && (
                              <span className="bg-white/30 px-1 rounded text-[10px]">
                                {res.issues[0]}
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 범례 */}
        <div className="flex gap-4 mt-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-xs text-gray-600">예약</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-xs text-gray-600">대여중</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-gray-400 rounded"></div>
            <span className="text-xs text-gray-600">반납 완료</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-xs text-gray-600">미납</span>
          </div>
        </div>

        {/* 예약 상세 팝업 */}
        {selectedReservation && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-[700px] max-h-[80vh] flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-[#1e2939]">예약 상세 정보</h2>
                  <button
                    onClick={() => setSelectedReservation(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 탭 네비게이션 */}
                <div className="flex gap-1 mt-4 border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab('reservation')}
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${
                      activeTab === 'reservation'
                        ? 'text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Calendar className="w-4 h-4 inline mr-2" />
                    예약 정보
                    {activeTab === 'reservation' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('payment')}
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${
                      activeTab === 'payment'
                        ? 'text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <DollarSign className="w-4 h-4 inline mr-2" />
                    결제 정보
                    {activeTab === 'payment' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('vehicle')}
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${
                      activeTab === 'vehicle'
                        ? 'text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Car className="w-4 h-4 inline mr-2" />
                    차량 정보
                    {activeTab === 'vehicle' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* 탭 컨텐츠 */}
              <div className="p-6 flex-1 overflow-y-auto">
                {/* 예약 정보 탭 */}
                {activeTab === 'reservation' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">예약번호</label>
                        <p className="text-lg text-gray-900 mt-1 font-bold">{selectedReservation.id}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">고객명</label>
                        <p className="text-lg text-gray-900 mt-1">{selectedReservation.customer}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">연락처</label>
                        <p className="text-lg text-gray-900 mt-1">{selectedReservation.phone}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">예약 유형</label>
                        <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full mt-2 ${
                          selectedReservation.type === 'reservation' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {selectedReservation.type === 'reservation' ? '예약' : '대여'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">차량번호</label>
                      <p className="text-lg text-gray-900 mt-1 font-bold">{selectedReservation.vehicleNumber}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">대여 시작일</label>
                        <p className="text-lg text-gray-900 mt-1">{selectedReservation.startDateFull}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">대여 종료일</label>
                        <p className="text-lg text-gray-900 mt-1">{selectedReservation.endDateFull}</p>
                      </div>
                    </div>

                    {selectedReservation.issues && selectedReservation.issues.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-2">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          이슈
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {selectedReservation.issues.map((issue, idx) => (
                            <span key={idx} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg font-medium">
                              {issue}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 결제 정보 탭 */}
                {activeTab === 'payment' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">대여 요금</label>
                        <p className="text-2xl text-gray-900 mt-1 font-bold">{selectedReservation.amount}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">선금</label>
                        <p className="text-2xl text-gray-900 mt-1 font-bold">{selectedReservation.deposit}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">결제 방법</label>
                      <p className="text-lg text-gray-900 mt-1">{selectedReservation.paymentMethod}</p>
                    </div>
                  </div>
                )}

                {/* 차량 자산 정보 탭 */}
                {activeTab === 'vehicle' && selectedVehicleAsset && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">차량번호</label>
                        <p className="text-lg text-gray-900 mt-1 font-bold">{selectedVehicleAsset.vehicleNumber}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">모델</label>
                        <p className="text-lg text-gray-900 mt-1 font-medium">{selectedVehicleAsset.model}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">연식</label>
                        <p className="text-lg text-gray-900 mt-1">{selectedVehicleAsset.year}년</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">차대번호</label>
                        <p className="text-base text-gray-900 mt-1 font-mono">{selectedVehicleAsset.vin}</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">차량 상태</label>
                      <p className="mt-2">
                        <span className={`inline-block px-4 py-2 rounded-lg font-medium ${getStatusColor(selectedVehicleAsset.status)}`}>
                          {selectedVehicleAsset.status}
                        </span>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">보험 만료일</label>
                        <p className="text-lg text-gray-900 mt-1">{selectedVehicleAsset.insuranceExpiry}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">다음 점검일</label>
                        <p className="text-lg text-gray-900 mt-1">{selectedVehicleAsset.nextInspection}</p>
                      </div>
                    </div>

                    {selectedVehicleAsset.issues.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-2">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          차량 이슈
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {selectedVehicleAsset.issues.map((issue, idx) => (
                            <span key={idx} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg font-medium">
                              {issue}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">소유주</label>
                      <p className="text-lg text-gray-900 mt-1">{selectedVehicleAsset.owner}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 액션 버튼 */}
              <div className="p-6 border-t border-gray-200 flex gap-3 flex-wrap">
                <button
                  onClick={() => navigate(`/assets?search=${encodeURIComponent(selectedReservation.vehicleNumber)}`)}
                  className="flex-1 min-w-[200px] px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  차량 자산 상세보기
                </button>
                <button
                  onClick={() => setShowAccidentModal(true)}
                  className="flex-1 min-w-[200px] px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  사고 등록
                </button>
                <button
                  onClick={() => {
                    // 차량번호로만 검색 (필터는 적용하지 않음)
                    navigate(`/action-required?search=${encodeURIComponent(selectedReservation.vehicleNumber)}`);
                  }}
                  className="flex-1 min-w-[200px] px-4 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium"
                >
                  이 차량의 조치항목 보기
                </button>
                {selectedReservation.type === 'reservation' && (
                  <button
                    onClick={() => {
                      if (confirm(`${selectedReservation.customer}님의 예약을 취소하시겠습니까?\n\n차량번호: ${selectedReservation.vehicleNumber}\n예약 기간: ${selectedReservation.startDateFull} ~ ${selectedReservation.endDateFull}`)) {
                        alert('예약이 취소되었습니다.\n\n고객에게 취소 안내 문자가 발송되었습니다.');
                        setSelectedReservation(null);
                        // 실제로는 예약 취소 처리 로직 실행
                      }
                    }}
                    className="flex-1 min-w-[200px] px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                  >
                    예약 취소
                  </button>
                )}
                {selectedReservation.type !== 'return' && (
                  <button
                    onClick={handleReturnClick}
                    className="flex-1 min-w-[200px] px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                  >
                    차량 반납 처리
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 새 계약 등록 모달 */}
        <NewContractModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setDragSelection(null);
          }}
          vehicles={vehicles}
          vehicleAssets={vehicleAssets}
          dragSelection={dragSelection}
        />

        {/* 반납 확인 모달 */}
        {showReturnConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-[400px] max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-[#1e2939]">차량 반납 확인</h2>
                  <button
                    onClick={() => setShowReturnConfirm(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-sm text-gray-700 mb-4">
                  {selectedReservation?.customer}님의 차량({selectedReservation?.vehicleNumber})을(를) 반납 처리하시겠습니까?
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmReturn}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                  >
                    확인
                  </button>
                  <button
                    onClick={() => setShowReturnConfirm(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 사고 등록 모달 */}
        {showAccidentModal && selectedReservation && (
          <AccidentReportModal
            isOpen={showAccidentModal}
            vehicleNumber={selectedReservation.vehicleNumber}
            customerName={selectedReservation.customer}
            onClose={() => setShowAccidentModal(false)}
            onSubmit={handleAccidentReport}
          />
        )}
      </div>
    </Layout>
  );
}