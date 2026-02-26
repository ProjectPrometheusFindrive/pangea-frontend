export type VehicleAssetStatus = '대여중' | '예약' | '가용' | '정비중';

export interface VehicleDeviceStatus {
  engineWarning: boolean;
  batteryVoltage: number;
  oilPressure: number;
  coolantTemp: number;
  tirePressure: [number, number, number, number];
  brakeFluid: number;
  absWarning: boolean;
  airbagWarning: boolean;
  transmissionTemp: number;
  fuelLevel: number;
  lastUpdate: string;
}

export interface DTCRecord {
  id: string;
  vehicleNumber: string;
  dtcCode: string;
  description: string;
  detectedAt: string;
  severity: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'resolved';
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
}

export interface VehicleAsset {
  vehicleNumber: string;
  model: string;
  status: VehicleAssetStatus;
  issues: string[];
  insuranceExpiry: string;
  nextInspection: string;
  vin: string;
  year: string;
  owner: string;
  hasPremiumDevice?: boolean;
  deviceStatus?: VehicleDeviceStatus;
  dtcHistory?: DTCRecord[];
  deviceSerialNumber?: string;
}
