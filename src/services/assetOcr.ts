import { ApiError, apiClient } from './api';

export interface AssetOcrRequestOptions {
  signal?: AbortSignal;
}

export interface AssetUploadSignPayload {
  fileName: string;
  folder: string;
  contentType?: string;
  ttlSeconds?: number;
  fileSize?: number;
}

export interface AssetUploadSignData {
  uploadUrl: string;
  objectName: string;
  publicUrl?: string;
  contentType: string;
}

export type OcrDocType =
  | 'registrationDoc'
  | 'insuranceDoc'
  | 'contract'
  | 'amortizationSchedule'
  | 'driverLicense';

export interface OcrExtractRequest {
  docType: OcrDocType;
  objectName: string;
  sourceName?: string;
  contentType?: string;
  ttlSeconds?: number;
  confidenceThreshold?: number;
  companyId?: string;
}

export interface OcrExtractedField {
  name: string;
  value: unknown;
  confidence: number;
}

export interface OcrWarning {
  code: string;
  message: string;
  field?: string;
}

export interface OcrJobError {
  type: string;
  message: string;
  httpStatus: number;
}

export interface OcrExtractJobStatusData {
  jobId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  docType: OcrDocType;
  objectName: string;
  sourceName?: string;
  deduped: boolean;
  createdAt: string;
  updatedAt: string;
  extractedFields: OcrExtractedField[];
  warnings: OcrWarning[];
  error?: OcrJobError | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unwrapV2Data<TPayload>(payload: unknown): TPayload {
  if (isRecord(payload) && payload.status === 'success' && 'data' in payload) {
    return payload.data as TPayload;
  }

  return payload as TPayload;
}

function mapUploadStatusToErrorCode(statusCode: number): string {
  if (statusCode === 400) {
    return 'VALIDATION_ERROR';
  }
  if (statusCode === 401) {
    return 'UNAUTHORIZED';
  }
  if (statusCode === 403) {
    return 'FORBIDDEN';
  }
  if (statusCode === 413) {
    return 'PAYLOAD_TOO_LARGE';
  }
  if (statusCode === 415) {
    return 'UNSUPPORTED_MEDIA_TYPE';
  }
  if (statusCode === 429) {
    return 'RATE_LIMITED';
  }
  if (statusCode >= 500) {
    return 'SERVER_ERROR';
  }
  return 'HTTP_ERROR';
}

export async function signAssetUpload(
  payload: AssetUploadSignPayload,
  options: AssetOcrRequestOptions = {},
): Promise<AssetUploadSignData> {
  const responsePayload = await apiClient.requestData<unknown>({
    path: '/api/v2/assets/upload',
    method: 'POST',
    body: payload,
    signal: options.signal,
  });

  const data = unwrapV2Data<AssetUploadSignData>(responsePayload);
  if (!isRecord(data) || typeof data.uploadUrl !== 'string' || typeof data.objectName !== 'string') {
    throw new ApiError('SERVER_ERROR', '업로드 URL 응답 형식이 올바르지 않습니다.');
  }

  return {
    uploadUrl: data.uploadUrl,
    objectName: data.objectName,
    publicUrl: typeof data.publicUrl === 'string' ? data.publicUrl : undefined,
    contentType: typeof data.contentType === 'string' ? data.contentType : payload.contentType ?? '',
  };
}

export async function uploadFileToSignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
  options: AssetOcrRequestOptions = {},
): Promise<void> {
  let response: Response;
  const isEmulatorJsonUpload = uploadUrl.includes('/upload/storage/v1/b/');
  const method = isEmulatorJsonUpload ? 'POST' : 'PUT';

  try {
    response = await fetch(uploadUrl, {
      method,
      headers: {
        'Content-Type': contentType,
      },
      body: file,
      signal: options.signal,
    });
  } catch (error) {
    if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new ApiError('NETWORK_ERROR', '파일 업로드 중 네트워크 오류가 발생했습니다.', {
      cause: error,
    });
  }

  if (response.ok) {
    return;
  }

  let responseMessage = '';
  try {
    responseMessage = (await response.text()).trim();
  } catch {
    responseMessage = '';
  }

  const fallbackMessage = `파일 업로드에 실패했습니다. (HTTP ${response.status})`;
  const message = responseMessage
    ? `${fallbackMessage} ${responseMessage.slice(0, 160)}`
    : fallbackMessage;

  throw new ApiError(mapUploadStatusToErrorCode(response.status), message, {
    status: response.status,
    payload: responseMessage || undefined,
  });
}

export async function submitOcrExtractJob(
  payload: OcrExtractRequest,
  options: AssetOcrRequestOptions = {},
): Promise<OcrExtractJobStatusData> {
  const responsePayload = await apiClient.requestData<unknown>({
    path: '/api/v2/ocr/extract',
    method: 'POST',
    body: payload,
    signal: options.signal,
  });

  return unwrapV2Data<OcrExtractJobStatusData>(responsePayload);
}

export async function getOcrExtractJob(
  jobId: string,
  options: AssetOcrRequestOptions = {},
): Promise<OcrExtractJobStatusData> {
  const responsePayload = await apiClient.requestData<unknown>({
    path: `/api/v2/ocr/jobs/${encodeURIComponent(jobId)}`,
    method: 'GET',
    signal: options.signal,
  });

  return unwrapV2Data<OcrExtractJobStatusData>(responsePayload);
}
