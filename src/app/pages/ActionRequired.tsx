import { Layout } from '../components/Layout';
import { useSearchParams, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { Search, X, ArrowUp, ArrowDown, Clock, User, CheckCircle2 } from 'lucide-react';
import { PageStateBoundary } from '../components/PageStateBoundary';
import { 
  mockPayments, 
  getUnpaidPayments, 
  calculateOverdueDays, 
  calculateLateFee, 
  getPaymentSeverity,
  type Payment,
} from '../utils/paymentUtils';
import { actionItems as mockActionItems, type MemoLog, type ActionItem as BaseActionItem } from '../data/mockData';

interface ActionItem {
  id: string;
  type: string;
  vehicleNumber: string;
  customerName: string;
  date: string;
  severity: 'High' | 'Medium' | 'Low';
  status: string;
  assignee: string;
  memos?: MemoLog[];
  paymentInfo?: {
    amount: number;
    overdueDays: number;
    lateFee: number;
    totalAmount: number;
    dueDate: string;
    paymentType: string;
  };
}

type SortField = 'type' | 'vehicleNumber' | 'customerName' | 'date' | 'severity' | 'status' | 'assignee';
type SortDirection = 'asc' | 'desc' | null;

export default function ActionRequired() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<ActionItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentMemo, setCurrentMemo] = useState('');
  const [currentStatus, setCurrentStatus] = useState('');
  const [resolvedItemIds, setResolvedItemIds] = useState<Set<string>>(new Set());
  const [sourceActionItems, setSourceActionItems] = useState<BaseActionItem[]>([]);
  const [sourcePayments, setSourcePayments] = useState<Payment[]>([]);
  const [isItemsLoading, setIsItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);

  // URL 파라미터에서 필터 읽기
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam && filterChips.includes(filterParam)) {
      setSelectedFilters([filterParam]);
    }
  }, [searchParams]);

  const filterChips = [
    '사고 접수',
    '반납 지연',
    '미납/결제 문제',
    '단말 OFF',
    '도난 의심',
    '정기점검',
    '차량이상',
    '보험 만료 임박',
  ];

  const hydrateActionItems = () => {
    setIsItemsLoading(true);
    setItemsError(null);
    try {
      setSourceActionItems(mockActionItems);
      setSourcePayments(mockPayments);
    } catch (error) {
      console.error(error);
      setSourceActionItems([]);
      setSourcePayments([]);
      setItemsError('조치 필요 항목 데이터를 불러오지 못했습니다.');
    } finally {
      setIsItemsLoading(false);
    }
  };

  useEffect(() => {
    hydrateActionItems();
  }, []);

  // mockData.ts의 actionItems를 ActionItem 형식으로 변환
  const convertedActionItems: ActionItem[] = sourceActionItems.map(item => ({
    id: item.id,
    type: item.category,
    vehicleNumber: item.vehicleNumber,
    customerName: item.customer || '-',
    date: item.dueDate,
    severity: item.priority === 'high' ? 'High' : item.priority === 'medium' ? 'Medium' : 'Low',
    status: item.status === 'pending' ? '대기중' : item.status === 'in-progress' ? '진행중' : '완료',
    assignee: item.assignee || '-',
    memos: item.memos,
  }));

  // 미납 데이터를 ActionItem으로 변환
  const unpaidPayments = getUnpaidPayments(sourcePayments);
  const unpaidActionItems: ActionItem[] = unpaidPayments.map(payment => {
    const overdueDays = calculateOverdueDays(payment.dueDate);
    const lateFee = calculateLateFee(payment.amount, overdueDays);
    const severity = getPaymentSeverity(payment);
    
    return {
      id: payment.id,
      type: '미납/결제 문제',
      vehicleNumber: payment.vehicleNumber,
      customerName: payment.customerName,
      date: payment.dueDate,
      severity: severity,
      status: `${overdueDays}일 연체`,
      assignee: '정산팀',
      paymentInfo: {
        amount: payment.amount,
        overdueDays: overdueDays,
        lateFee: lateFee,
        totalAmount: payment.amount + lateFee,
        dueDate: payment.dueDate,
        paymentType: payment.type,
      }
    };
  });

  // 모든 데이터 합치기
  const allItems: ActionItem[] = [
    ...convertedActionItems,
    ...unpaidActionItems,
  ].filter(item => !resolvedItemIds.has(item.id)); // 해결된 항목 제외

  const toggleFilter = (filter: string) => {
    setSelectedFilters(prev =>
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const filteredItems = allItems.filter(item => {
    const matchesFilter = selectedFilters.length === 0 || selectedFilters.includes(item.type);
    const matchesSearch = searchQuery === '' || 
      item.vehicleNumber?.includes(searchQuery) ||
      item.customerName?.includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  // 미납 필터가 선택되었는지 확인
  const isUnpaidFilterActive = selectedFilters.includes('미납/결제 문제');

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'High':
        return 'bg-red-100 text-red-700';
      case 'Medium':
        return 'bg-orange-100 text-orange-700';
      case 'Low':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedItems = filteredItems.sort((a, b) => {
    if (!sortField) return 0;
    const aValue = a[sortField];
    const bValue = b[sortField];
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    return 0;
  });

  const handleMemoAdd = () => {
    if (selectedItem && currentMemo) {
      const statusLabel = currentStatus || selectedItem.status;
      let statusValue: 'pending' | 'in-progress' | 'resolved' = 'pending';
      
      if (statusLabel.includes('진행') || statusLabel.includes('중')) {
        statusValue = 'in-progress';
      } else if (statusLabel.includes('완료')) {
        statusValue = 'resolved';
      }
      
      const newMemo: MemoLog = {
        id: Date.now().toString(),
        content: currentMemo,
        timestamp: new Date().toISOString(),
        author: '김민수',
        status: statusValue,
        statusLabel: statusLabel
      };
      
      const updatedItem: ActionItem = {
        ...selectedItem,
        status: currentStatus || selectedItem.status,
        memos: [...(selectedItem.memos || []), newMemo],
      };
      
      setSelectedItem(updatedItem);
      setCurrentMemo('');
      setCurrentStatus('');
    }
  };

  const handleResolveIssue = () => {
    if (!selectedItem) return;
    
    if (confirm(`"${selectedItem.type}" 이슈를 해결 완료 처리하시겠습니까?\n\n해결된 항목은 목록에서 제거됩니다.`)) {
      // 해결된 항목 ID 추가
      setResolvedItemIds(prev => new Set([...prev, selectedItem.id]));
      setSelectedItem(null);
      alert('✅ 이슈가 해결 완료되었습니다.\n목록에서 제거되었습니다.');
    }
  };

  return (
    <Layout title="조치 필요 항목">
      <div className="p-6">
        {/* 검색 및 필터 */}
        <div className="mb-6 space-y-4">
          {/* 검색창 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="차량번호 또는 고객명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 필터 칩 */}
          <div className="flex flex-wrap gap-2">
            {filterChips.map((chip) => {
              const isSelected = selectedFilters.includes(chip);
              return (
                <button
                  key={chip}
                  onClick={() => toggleFilter(chip)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {chip}
                  {isSelected && <X className="inline-block ml-1 w-3 h-3" />}
                </button>
              );
            })}
          </div>

          {/* 결과 개수 표시 */}
          <div className="text-sm text-gray-600">
            총 <span className="font-bold text-blue-600">{sortedItems.length}</span>건의 조치 필요 항목
            {resolvedItemIds.size > 0 && (
              <span className="ml-2 text-green-600">
                (해결 완료: {resolvedItemIds.size}건)
              </span>
            )}
          </div>
        </div>

        {/* 테이블 */}
        <PageStateBoundary
          isLoading={isItemsLoading}
          error={itemsError}
          isEmpty={!isItemsLoading && !itemsError && sortedItems.length === 0}
          errorDescription="조치 필요 항목 목록을 불러오는 중 문제가 발생했습니다."
          emptyTitle="조건에 맞는 조치 항목이 없습니다"
          emptyDescription="필터나 검색어를 조정해 다시 확인해 주세요."
          onRetry={hydrateActionItems}
          className="min-h-[280px]"
        >
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('type')}>
                      유형
                      {sortField === 'type' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('vehicleNumber')}>
                      차량번호
                      {sortField === 'vehicleNumber' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('customerName')}>
                      고객명
                      {sortField === 'customerName' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('date')}>
                      발생일
                      {sortField === 'date' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    {isUnpaidFilterActive && (
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        미납금액
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('severity')}>
                      심각도
                      {sortField === 'severity' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('status')}>
                      상태
                      {sortField === 'status' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('assignee')}>
                      담당자
                      {sortField === 'assignee' && (sortDirection === 'asc' ? <ArrowUp className="inline-block ml-1 w-3 h-3" /> : <ArrowDown className="inline-block ml-1 w-3 h-3" />)}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.type}</td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/assets?vehicle=${encodeURIComponent(item.vehicleNumber)}`);
                        }}
                      >
                        {item.vehicleNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.customerName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.date}</td>
                      {isUnpaidFilterActive && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {item.paymentInfo ? (
                            <span className="font-bold text-red-600">
                              {item.paymentInfo.totalAmount.toLocaleString()}원
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(item.severity)}`}>
                          {item.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.status}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.assignee}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          className="text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => setSelectedItem(item)}
                        >
                          보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </PageStateBoundary>

        {/* 상세 패널 (오른쪽 슬라이드) */}
        {selectedItem && (
          <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-[#1e2939]">상세 정보</h2>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600">유형</label>
                  <p className="text-base text-gray-900 mt-1">{selectedItem.type}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">차량번호</label>
                  <p className="text-base text-gray-900 mt-1">{selectedItem.vehicleNumber}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">고객명</label>
                  <p className="text-base text-gray-900 mt-1">{selectedItem.customerName}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">발생일</label>
                  <p className="text-base text-gray-900 mt-1">{selectedItem.date}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">심각도</label>
                  <p className="text-base text-gray-900 mt-1">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(selectedItem.severity)}`}>
                      {selectedItem.severity}
                    </span>
                  </p>
                </div>

                {/* 미납 결제 정보 표시 */}
                {selectedItem.paymentInfo && (
                  <div className="border-t border-gray-200 pt-4">
                    <label className="text-sm font-semibold text-gray-600 mb-3 block">결제 정보</label>
                    <div className="bg-red-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">결제 유형</span>
                        <span className="text-sm font-semibold text-gray-900">{selectedItem.paymentInfo.paymentType}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">원금</span>
                        <span className="text-sm font-semibold text-gray-900">{selectedItem.paymentInfo.amount.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">연체 일수</span>
                        <span className="text-sm font-bold text-red-600">{selectedItem.paymentInfo.overdueDays}일</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">연체료 (2%/일)</span>
                        <span className="text-sm font-semibold text-red-600">{selectedItem.paymentInfo.lateFee.toLocaleString()}원</span>
                      </div>
                      <div className="border-t border-red-200 pt-2 mt-2 flex justify-between items-center">
                        <span className="text-base font-bold text-gray-900">총 청구금액</span>
                        <span className="text-lg font-bold text-red-600">{selectedItem.paymentInfo.totalAmount.toLocaleString()}원</span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold text-gray-600">현재 상태</label>
                  <div className="flex gap-2 mt-1">
                    <select
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={currentStatus || selectedItem.status}
                      onChange={(e) => setCurrentStatus(e.target.value)}
                    >
                      <option value="대기중">대기중</option>
                      <option value="진행중">진행중</option>
                      <option value="완료">완료</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">처리 메모</label>
                  <textarea
                    rows={3}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="처리 내용을 입력하세요..."
                    value={currentMemo}
                    onChange={(e) => setCurrentMemo(e.target.value)}
                  />
                  <button
                    className="mt-2 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                    onClick={handleMemoAdd}
                    disabled={!currentMemo.trim()}
                  >
                    메모 저장
                  </button>
                </div>

                {/* 메모 히스토리 */}
                {selectedItem.memos && selectedItem.memos.length > 0 && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-2 block">처리 내역</label>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {selectedItem.memos.map((memo) => (
                        <div key={memo.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-3 h-3 text-gray-500" />
                            <span className="text-xs text-gray-500">
                              {new Date(memo.timestamp).toLocaleString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-3 h-3 text-blue-500" />
                            <span className="text-xs font-semibold text-blue-700">{memo.author}</span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              memo.status === 'resolved' 
                                ? 'bg-green-100 text-green-700' 
                                : memo.status === 'in-progress'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {memo.statusLabel}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{memo.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 space-y-2">
                  <button
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    onClick={() => navigate(`/assets?vehicle=${encodeURIComponent(selectedItem.vehicleNumber)}`)}>
                    관련 자산 보기
                  </button>
                  <button
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                    onClick={() => navigate(`/reservations?search=${encodeURIComponent(selectedItem.customerName)}`)}>
                    관련 예약 보기
                  </button>
                  
                  {/* 이슈 해결 완료 버튼 */}
                  {selectedItem.status !== '완료' && (
                    <button
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
                      onClick={handleResolveIssue}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      이슈 해결 완료
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
