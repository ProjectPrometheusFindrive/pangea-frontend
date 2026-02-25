import { Layout } from '../components/Layout';
import { useEffect, useState } from 'react';
import { Camera, CheckCircle, XCircle, AlertCircle, Zap, Signal } from 'lucide-react';
import { PageStateBoundary } from '../components/PageStateBoundary';
import { vehicleAssets, type VehicleAsset } from '../data/mockData';
import { useAuth } from '../context/AuthContext';

interface InstallationVehicle extends VehicleAsset {
  installationStatus: 'pending' | 'completed' | 'failed';
  deviceSerialNumber?: string;
  installedAt?: string;
  installer?: string;
  photoUrl?: string;
  serialPhotoUrl?: string;
  healthCheck?: {
    signal: 'good' | 'weak' | 'none';
    battery: number;
    gps: boolean;
    lastContact: string;
  };
}

const buildInstallationVehicles = (): InstallationVehicle[] =>
  vehicleAssets.slice(0, 10).map(v => ({
    ...v,
    installationStatus: v.hasPremiumDevice ? 'completed' : 'pending',
    deviceSerialNumber: v.hasPremiumDevice ? v.deviceSerialNumber : undefined,
    healthCheck: v.hasPremiumDevice ? {
      signal: 'good',
      battery: 85,
      gps: true,
      lastContact: '방금 전',
    } : undefined,
  }));

export default function DeviceInstallation() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<InstallationVehicle[]>([]);
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(true);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);

  const [selectedVehicleNumber, setSelectedVehicleNumber] = useState('');
  const [deviceSerial, setDeviceSerial] = useState('');
  const [installationPhotoFile, setInstallationPhotoFile] = useState<File | null>(null);
  const [installationPhotoPreview, setInstallationPhotoPreview] = useState<string>('');
  const [serialPhotoFile, setSerialPhotoFile] = useState<File | null>(null);
  const [serialPhotoPreview, setSerialPhotoPreview] = useState<string>('');

  const hydrateVehicles = () => {
    setIsVehiclesLoading(true);
    setVehiclesError(null);
    try {
      setVehicles(buildInstallationVehicles());
    } catch (error) {
      console.error(error);
      setVehicles([]);
      setVehiclesError('장착 대상 차량 데이터를 불러오지 못했습니다.');
    } finally {
      setIsVehiclesLoading(false);
    }
  };

  useEffect(() => {
    hydrateVehicles();
  }, []);

  const handleInstallDevice = () => {
    if (!selectedVehicleNumber || !deviceSerial || !installationPhotoFile || !serialPhotoFile) {
      alert('모든 필드를 입력하고 사진을 업로드해주세요.');
      return;
    }

    // 시리얼 번호 중복 확인
    const existingDevice = vehicles.find(v => v.deviceSerialNumber === deviceSerial);
    if (existingDevice) {
      alert(`이 단말 시리얼 번호는 이미 ${existingDevice.vehicleNumber}에 장착되어 있습니다.`);
      return;
    }

    // 차량 업데이트
    setVehicles(prev => prev.map(v => {
      if (v.vehicleNumber === selectedVehicleNumber) {
        return {
          ...v,
          installationStatus: 'completed',
          deviceSerialNumber: deviceSerial,
          installedAt: new Date().toISOString(),
          installer: user?.name ?? '미인증 사용자',
          photoUrl: installationPhotoPreview,
          serialPhotoUrl: serialPhotoPreview,
          hasPremiumDevice: true,
          healthCheck: {
            signal: 'good',
            battery: 100,
            gps: true,
            lastContact: '방금 전',
          },
        };
      }
      return v;
    }));

    alert(`✅ 단말 장착이 완료되었습니다!\n\n차량번호: ${selectedVehicleNumber}\n단말 시리얼: ${deviceSerial}\n장착 일시: ${new Date().toLocaleString('ko-KR')}`);

    // 초기화
    setSelectedVehicleNumber('');
    setDeviceSerial('');
    setInstallationPhotoFile(null);
    setInstallationPhotoPreview('');
    setSerialPhotoFile(null);
    setSerialPhotoPreview('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            완료
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            <AlertCircle className="w-3 h-3" />
            대기
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" />
            실패
          </span>
        );
      default:
        return null;
    }
  };

  const getSignalIcon = (signal: 'good' | 'weak' | 'none') => {
    switch (signal) {
      case 'good':
        return <Signal className="w-4 h-4 text-green-600" />;
      case 'weak':
        return <Signal className="w-4 h-4 text-orange-600" />;
      case 'none':
        return <Signal className="w-4 h-4 text-red-600" />;
    }
  };

  const pendingCount = vehicles.filter(v => v.installationStatus === 'pending').length;
  const completedCount = vehicles.filter(v => v.installationStatus === 'completed').length;

  return (
    <Layout title="단말 장착/관리">
      <div className="p-6">
        {/* 헤더 - 최소화 */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4 mb-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6" />
              <h2 className="text-lg font-bold">단말 장착 작업</h2>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span>대기: <strong>{pendingCount}</strong>건</span>
              <span>완료: <strong>{completedCount}</strong>건</span>
            </div>
          </div>
        </div>

        {/* 입력 폼 - 한 줄로 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex gap-3 items-end">
            {/* 차량번호 선택 */}
            <div className="flex-shrink-0" style={{ width: '180px' }}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                차량번호
              </label>
              <select
                value={selectedVehicleNumber}
                onChange={(e) => setSelectedVehicleNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">선택하세요</option>
                {vehicles
                  .filter(v => v.installationStatus === 'pending')
                  .map(v => (
                    <option key={v.vehicleNumber} value={v.vehicleNumber}>
                      {v.vehicleNumber} ({v.model})
                    </option>
                  ))}
              </select>
            </div>

            {/* 단말 시리얼 번호 */}
            <div className="flex-shrink-0" style={{ width: '180px' }}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                단말 시리얼 번호
              </label>
              <input
                type="text"
                placeholder="DEV-2024-XXX"
                value={deviceSerial}
                onChange={(e) => setDeviceSerial(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>

            {/* 장착 사진 업로드 */}
            <div className="flex-shrink-0" style={{ width: '140px' }}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                장착 사진 <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setInstallationPhotoFile(file);
                      setInstallationPhotoPreview(URL.createObjectURL(file));
                    }
                  }}
                  id="photo-upload"
                  className="hidden"
                />
                <label
                  htmlFor="photo-upload"
                  className={`flex items-center justify-center gap-2 w-full px-3 py-2 border rounded-lg cursor-pointer transition-colors text-sm ${
                    installationPhotoFile
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {installationPhotoFile ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>첨부됨</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>📷 촬영</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* 장착사진 미리보기 */}
            {installationPhotoPreview && (
              <div className="flex-shrink-0" style={{ width: '50px' }}>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  &nbsp;
                </label>
                <div className="relative h-[38px] w-full border border-gray-300 rounded-lg overflow-hidden cursor-pointer" onClick={() => window.open(installationPhotoPreview, '_blank')}>
                  <img
                    src={installationPhotoPreview}
                    alt="장착사진"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* 시리얼 번호 사진 업로드 */}
            <div className="flex-shrink-0" style={{ width: '140px' }}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                시리얼 사진 <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSerialPhotoFile(file);
                      setSerialPhotoPreview(URL.createObjectURL(file));
                    }
                  }}
                  id="serial-photo-upload"
                  className="hidden"
                />
                <label
                  htmlFor="serial-photo-upload"
                  className={`flex items-center justify-center gap-2 w-full px-3 py-2 border rounded-lg cursor-pointer transition-colors text-sm ${
                    serialPhotoFile
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {serialPhotoFile ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>첨부됨</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>📷 촬영</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* 시리얼사진 미리보기 */}
            {serialPhotoPreview && (
              <div className="flex-shrink-0" style={{ width: '50px' }}>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  &nbsp;
                </label>
                <div className="relative h-[38px] w-full border border-gray-300 rounded-lg overflow-hidden cursor-pointer" onClick={() => window.open(serialPhotoPreview, '_blank')}>
                  <img
                    src={serialPhotoPreview}
                    alt="시리얼사진"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* 장착 완료 버튼 */}
            <div className="flex-shrink-0 ml-auto" style={{ width: '120px' }}>
              <button
                onClick={handleInstallDevice}
                disabled={!selectedVehicleNumber || !deviceSerial || !installationPhotoFile || !serialPhotoFile}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                장착 완료
              </button>
            </div>
          </div>
        </div>

        {/* 장착 대상 차량 리스트 - 테이블 형태 */}
        <PageStateBoundary
          isLoading={isVehiclesLoading}
          error={vehiclesError}
          isEmpty={!isVehiclesLoading && !vehiclesError && vehicles.length === 0}
          errorDescription="장착 대상 차량 목록을 불러오는 중 문제가 발생했습니다."
          emptyTitle="장착 대상 차량이 없습니다"
          emptyDescription="새 차량이 동기화되면 목록에 표시됩니다."
          onRetry={hydrateVehicles}
          className="min-h-[280px]"
        >
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-900">장착 대상 차량 리스트</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">차량번호</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">차종</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">연식</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">단말 시리얼</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">작업자</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">장착 일시</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Health Check</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">장착사진</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">시리얼사진</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {vehicles.map((vehicle) => (
                    <tr
                      key={vehicle.vehicleNumber}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* 상태 */}
                      <td className="px-4 py-3">
                        {getStatusBadge(vehicle.installationStatus)}
                      </td>

                      {/* 차량번호 */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-gray-900 text-sm">
                          {vehicle.vehicleNumber}
                        </span>
                      </td>

                      {/* 차종 */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{vehicle.model}</span>
                      </td>

                      {/* 연식 */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{vehicle.year}년</span>
                      </td>

                      {/* 단말 시리얼 */}
                      <td className="px-4 py-3">
                        {vehicle.deviceSerialNumber ? (
                          <span className="font-mono text-xs text-gray-900 bg-gray-100 px-2 py-1 rounded">
                            {vehicle.deviceSerialNumber}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      {/* 작업자 */}
                      <td className="px-4 py-3">
                        {vehicle.installer ? (
                          <span className="text-sm text-gray-700">{vehicle.installer}</span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      {/* 장착 일시 */}
                      <td className="px-4 py-3">
                        {vehicle.installedAt ? (
                          <span className="text-xs text-gray-600">
                            {new Date(vehicle.installedAt).toLocaleString('ko-KR', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      {/* Health Check */}
                      <td className="px-4 py-3">
                        {vehicle.healthCheck ? (
                          <div className="flex items-center gap-2">
                            {getSignalIcon(vehicle.healthCheck.signal)}
                            <div className="text-xs">
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-gray-700">
                                  {vehicle.healthCheck.signal === 'good' ? '정상' : vehicle.healthCheck.signal === 'weak' ? '약함' : '없음'}
                                </span>
                              </div>
                              <div className="text-gray-500">
                                배터리: {vehicle.healthCheck.battery}%
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      {/* 장착사진 */}
                      <td className="px-4 py-3">
                        {vehicle.photoUrl ? (
                          <button
                            onClick={() => window.open(vehicle.photoUrl, '_blank')}
                            className="text-blue-600 hover:text-blue-700 text-xs underline"
                          >
                            보기
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      {/* 시리얼사진 */}
                      <td className="px-4 py-3">
                        {vehicle.serialPhotoUrl ? (
                          <button
                            onClick={() => window.open(vehicle.serialPhotoUrl, '_blank')}
                            className="text-blue-600 hover:text-blue-700 text-xs underline"
                          >
                            보기
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </PageStateBoundary>
      </div>
    </Layout>
  );
}
