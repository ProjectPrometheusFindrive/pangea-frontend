import { Layout } from '../components/Layout';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { TrendingUp, DollarSign, CreditCard, Wallet, Car, Users, Calendar, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getUnpaidStatsByPeriod } from '../utils/paymentUtils';
import { vehicleAssets } from '../data/mockData';

type Period = 'weekly' | 'monthly' | 'yearly';

export default function Revenue() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('monthly');
  const navigate = useNavigate();

  // 기간별 미납금 계산
  const unpaidStats = getUnpaidStatsByPeriod();
  const getUnpaidByPeriod = () => {
    switch (selectedPeriod) {
      case 'weekly':
        return unpaidStats.weekly;
      case 'monthly':
        return unpaidStats.monthly;
      case 'yearly':
        return unpaidStats.yearly;
    }
  };
  const currentUnpaid = getUnpaidByPeriod();

  // 주간 매출 데이터 (최근 7일)
  const weeklyData = [
    { date: '2/13 (월)', revenue: 2800000, rentals: 12, avgPrice: 233000 },
    { date: '2/14 (화)', revenue: 3200000, rentals: 14, avgPrice: 228000 },
    { date: '2/15 (수)', revenue: 2500000, rentals: 10, avgPrice: 250000 },
    { date: '2/16 (목)', revenue: 3800000, rentals: 16, avgPrice: 237000 },
    { date: '2/17 (금)', revenue: 4200000, rentals: 18, avgPrice: 233000 },
    { date: '2/18 (토)', revenue: 5100000, rentals: 22, avgPrice: 231000 },
    { date: '2/19 (일)', revenue: 4800000, rentals: 20, avgPrice: 240000 },
  ];

  // 지난주 매출 데이터 (비교용)
  const lastWeekData = [
    { date: '2/6 (월)', revenue: 2600000, rentals: 11, avgPrice: 236000 },
    { date: '2/7 (화)', revenue: 2900000, rentals: 13, avgPrice: 223000 },
    { date: '2/8 (수)', revenue: 2400000, rentals: 10, avgPrice: 240000 },
    { date: '2/9 (목)', revenue: 3500000, rentals: 15, avgPrice: 233000 },
    { date: '2/10 (금)', revenue: 3900000, rentals: 17, avgPrice: 229000 },
    { date: '2/11 (토)', revenue: 4700000, rentals: 20, avgPrice: 235000 },
    { date: '2/12 (일)', revenue: 4500000, rentals: 19, avgPrice: 236000 },
  ];

  // 월간 매출 데이터 (최근 6개월)
  const monthlyData = [
    { month: '9월', revenue: 45000000, rentals: 180, avgPrice: 250000 },
    { month: '10월', revenue: 52000000, rentals: 210, avgPrice: 247000 },
    { month: '11월', revenue: 48000000, rentals: 195, avgPrice: 246000 },
    { month: '12월', revenue: 58000000, rentals: 230, avgPrice: 252000 },
    { month: '1월', revenue: 62000000, rentals: 250, avgPrice: 248000 },
    { month: '2월', revenue: 68000000, rentals: 280, avgPrice: 242000 },
  ];

  // 지난 6개월 매출 데이터 (비교용)
  const lastSixMonthsData = [
    { month: '3월', revenue: 42000000, rentals: 170, avgPrice: 247000 },
    { month: '4월', revenue: 46000000, rentals: 185, avgPrice: 248000 },
    { month: '5월', revenue: 44000000, rentals: 178, avgPrice: 247000 },
    { month: '6월', revenue: 50000000, rentals: 200, avgPrice: 250000 },
    { month: '7월', revenue: 48000000, rentals: 195, avgPrice: 246000 },
    { month: '8월', revenue: 43000000, rentals: 175, avgPrice: 245000 },
  ];

  // 연간 매출 데이터 (최근 3년)
  const yearlyData = [
    { year: '2023', revenue: 520000000, rentals: 2100, avgPrice: 247000 },
    { year: '2024', revenue: 680000000, rentals: 2750, avgPrice: 247000 },
    { year: '2025', revenue: 850000000, rentals: 3400, avgPrice: 250000 },
  ];

  // 지난 3년 매출 데이터 (비교용)
  const lastThreeYearsData = [
    { year: '2020', revenue: 380000000, rentals: 1550, avgPrice: 245000 },
    { year: '2021', revenue: 450000000, rentals: 1820, avgPrice: 247000 },
    { year: '2022', revenue: 490000000, rentals: 1980, avgPrice: 247000 },
  ];

  // 결제 방법별 데이터
  const paymentMethodData = [
    { name: '카드', value: 45, amount: 30600000 },
    { name: '현금', value: 28, amount: 19040000 },
    { name: '계좌이체', value: 27, amount: 18360000 },
  ];

  // 차량별 매출 데이터
  const vehicleRevenueData = [
    { model: '그랜저', revenue: 12800000, rentals: 48, utilization: 92 },
    { model: '쏘나타', revenue: 10500000, rentals: 52, utilization: 88 },
    { model: 'K5', revenue: 9200000, rentals: 45, utilization: 85 },
    { model: '팰리세이드', revenue: 11600000, rentals: 42, utilization: 90 },
    { model: '투싼', revenue: 8900000, rentals: 50, utilization: 87 },
    { model: 'K8', revenue: 10200000, rentals: 38, utilization: 84 },
    { model: '아반떼', revenue: 7800000, rentals: 55, utilization: 82 },
    { model: '쏘렌토', revenue: 9000000, rentals: 40, utilization: 86 },
  ].sort((a, b) => b.revenue - a.revenue);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const getCurrentData = () => {
    switch (selectedPeriod) {
      case 'weekly':
        return weeklyData;
      case 'monthly':
        return monthlyData;
      case 'yearly':
        return yearlyData;
    }
  };

  const getTotalRevenue = () => {
    const data = getCurrentData();
    return data.reduce((sum, item) => sum + item.revenue, 0);
  };

  const getTotalRentals = () => {
    const data = getCurrentData();
    return data.reduce((sum, item) => sum + item.rentals, 0);
  };

  const getAveragePrice = () => {
    const data = getCurrentData();
    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
    const totalRentals = data.reduce((sum, item) => sum + item.rentals, 0);
    return Math.round(totalRevenue / totalRentals);
  };

  const getGrowthRate = () => {
    // 현재 기간 총 매출
    const currentData = getCurrentData();
    const currentTotal = currentData.reduce((sum, item) => sum + item.revenue, 0);
    
    // 이전 기간 총 매출
    let previousData;
    switch (selectedPeriod) {
      case 'weekly':
        previousData = lastWeekData;
        break;
      case 'monthly':
        previousData = lastSixMonthsData;
        break;
      case 'yearly':
        previousData = lastThreeYearsData;
        break;
    }
    const previousTotal = previousData.reduce((sum: number, item: any) => sum + item.revenue, 0);
    
    // 성장률 계산
    if (previousTotal === 0) return 0;
    return Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
  };

  const formatCurrency = (amount: number) => {
    return `${(amount / 10000).toLocaleString()}만원`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'weekly':
        return '주간';
      case 'monthly':
        return '월간';
      case 'yearly':
        return '연간';
    }
  };

  const getComparisonLabel = () => {
    switch (selectedPeriod) {
      case 'weekly':
        return '지난주 대비';
      case 'monthly':
        return '전 기간 대비';
      case 'yearly':
        return '전 기간 대비';
    }
  };

  const getXAxisKey = () => {
    switch (selectedPeriod) {
      case 'weekly':
        return 'date';
      case 'monthly':
        return 'month';
      case 'yearly':
        return 'year';
    }
  };

  // 활성 차량 수 계산 (대여중 + 예약됨 + 가용 = 정비중 제외)
  const getActiveVehicles = () => {
    return vehicleAssets.filter(v => v.status !== '정비중').length;
  };

  // 평균 가동률 계산
  const getAverageUtilization = () => {
    const totalUtilization = vehicleRevenueData.reduce((sum, v) => sum + v.utilization, 0);
    return Math.round(totalUtilization / vehicleRevenueData.length);
  };

  return (
    <Layout title="매출 요약">
      <div className="p-4 h-full overflow-auto">
        {/* 기간 선택 */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-semibold text-gray-600">기간:</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setSelectedPeriod('weekly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === 'weekly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              주간
            </button>
            <button
              onClick={() => setSelectedPeriod('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              월간
            </button>
            <button
              onClick={() => setSelectedPeriod('yearly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              연간
            </button>
          </div>
        </div>

        {/* 주요 지표 카드 */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          {/* 총 매출 */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-600">총 매출</span>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {formatCurrency(getTotalRevenue())}
            </div>
            <div className="flex items-center gap-1">
              {getGrowthRate() >= 0 ? (
                <>
                  <ArrowUp className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">
                    {getGrowthRate()}%
                  </span>
                </>
              ) : (
                <>
                  <ArrowDown className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-600">
                    {Math.abs(getGrowthRate())}%
                  </span>
                </>
              )}
              <span className="text-sm text-gray-500">{getComparisonLabel()}</span>
            </div>
          </div>

          {/* 총 대여 건수 */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-600">총 대여 건수</span>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {formatNumber(getTotalRentals())}건
            </div>
            <div className="text-sm text-gray-500">
              {getPeriodLabel()} 누적
            </div>
          </div>

          {/* 평균 대여 금액 */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-600">평균 대여 금액</span>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {formatCurrency(getAveragePrice())}
            </div>
            <div className="text-sm text-gray-500">
              건당 평균
            </div>
          </div>

          {/* 미납금 */}
          <div 
            className="bg-white rounded-xl p-5 shadow-sm border-2 border-red-200 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/action-required?filter=미납/결제 문제')}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-600">미납금</span>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-red-600 mb-1">
              {formatCurrency(currentUnpaid.amount)}
            </div>
            <div className="text-sm text-red-600 font-medium">
              {currentUnpaid.count}건 연체 중
            </div>
          </div>

          {/* 활성 차량 */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-600">활성 차량</span>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Car className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {getActiveVehicles()}대
            </div>
            <div className="text-sm text-gray-500">
              평균 가동률 {getAverageUtilization()}%
            </div>
          </div>
        </div>

        {/* 차트 영역 */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* 매출 추이 차트 */}
          <div className="col-span-2 bg-white rounded-xl p-5 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-4">
              {getPeriodLabel()} 매출 추이
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={getCurrentData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey={getXAxisKey()} 
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  tickFormatter={(value) => `${(value / 10000).toLocaleString()}만`}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 결제 방법별 분포 */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-4">결제 방법별 분포</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string, props: any) => [
                    formatCurrency(props.payload.amount),
                    `${value}%`
                  ]}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {paymentMethodData.map((method, index) => (
                <div key={method.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-gray-700">{method.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(method.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 차량별 매출 순위 */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-4">차량별 매출 현황</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">순위</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">차종</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">매출</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">대여 건수</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">가동률</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">매출 비중</th>
                </tr>
              </thead>
              <tbody>
                {vehicleRevenueData.map((vehicle, index) => {
                  const totalRevenue = vehicleRevenueData.reduce((sum, v) => sum + v.revenue, 0);
                  const percentage = ((vehicle.revenue / totalRevenue) * 100).toFixed(1);
                  
                  return (
                    <tr key={vehicle.model} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{vehicle.model}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(vehicle.revenue)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        {formatNumber(vehicle.rentals)}건
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          vehicle.utilization >= 90 ? 'bg-green-100 text-green-700' :
                          vehicle.utilization >= 85 ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {vehicle.utilization}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 w-12 text-right">
                            {percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}