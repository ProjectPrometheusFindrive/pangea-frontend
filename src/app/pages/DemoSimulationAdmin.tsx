import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Play, RefreshCw, RotateCcw, Save, Settings2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import { ApiError } from '../../services/api';
import {
  getDefaultDemoSimulationProfile,
  getDemoSimulationRun,
  getSavedDemoSimulationProfile,
  listDemoSimulationTenants,
  saveDemoSimulationProfile,
  startDemoSimulationRun,
  type DemoSimulationProfileValidationError,
  type DemoSimulationRun,
  type DemoSimulationRunMode,
  type DemoSimulationTenant,
} from '../../services/demoSimulation';
import { Layout } from '../components/Layout';
import { PageStateBoundary } from '../components/PageStateBoundary';

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.message) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return '데모 시뮬레이션 요청을 처리하지 못했습니다.';
}

function toValidationErrors(error: unknown): DemoSimulationProfileValidationError[] {
  if (error instanceof ApiError && Array.isArray(error.fields)) {
    return error.fields as DemoSimulationProfileValidationError[];
  }
  return [];
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function parseProfileDraft(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function statusLabel(status?: string): string {
  switch (status) {
    case 'queued':
      return '대기 중';
    case 'running':
      return '실행 중';
    case 'succeeded':
      return '완료';
    case 'failed':
      return '실패';
    default:
      return '미실행';
  }
}

function statusClass(status?: string): string {
  switch (status) {
    case 'succeeded':
      return 'bg-emerald-100 text-emerald-700';
    case 'failed':
      return 'bg-red-100 text-red-700';
    case 'queued':
    case 'running':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function validationErrorLabel(error: DemoSimulationProfileValidationError): string {
  const path = String(error.path || error.name || '').trim();
  const message = String(error.message || error.reason || '유효하지 않은 값입니다.').trim();
  return path ? `${path}: ${message}` : message;
}

export default function DemoSimulationAdmin() {
  const [companyId, setCompanyId] = useState('demo-company');
  const [seed, setSeed] = useState(() => Number(new Date().toISOString().slice(0, 10).replaceAll('-', '')));
  const [resetText, setResetText] = useState('');
  const [savedProfile, setSavedProfile] = useState<Record<string, unknown> | null>(null);
  const [profileSource, setProfileSource] = useState<'saved' | 'default'>('default');
  const [profileDraft, setProfileDraft] = useState('');
  const [validationErrors, setValidationErrors] = useState<DemoSimulationProfileValidationError[]>([]);
  const [tenants, setTenants] = useState<DemoSimulationTenant[]>([]);
  const [activeRun, setActiveRun] = useState<DemoSimulationRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedProfile = useMemo(() => parseProfileDraft(profileDraft), [profileDraft]);
  const isProfileValidJson = parsedProfile !== null;
  const savedProfileText = useMemo(() => (savedProfile ? formatJson(savedProfile) : ''), [savedProfile]);
  const hasUnsavedChanges = savedProfileText !== profileDraft;
  const canReset = resetText === companyId;
  const isRunActive = activeRun?.status === 'queued' || activeRun?.status === 'running';
  const canRun = !isSubmitting && !isRunActive && isProfileValidJson && !hasUnsavedChanges;

  const loadState = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    setValidationErrors([]);
    try {
      const [profilePayload, tenantsPayload] = await Promise.all([
        getSavedDemoSimulationProfile(companyId, signal),
        listDemoSimulationTenants(signal),
      ]);
      if (signal?.aborted) {
        return;
      }
      setSavedProfile(profilePayload.profile);
      setProfileDraft(formatJson(profilePayload.profile));
      setProfileSource(profilePayload.source ?? 'default');
      setTenants(tenantsPayload.items);
      const currentTenant = tenantsPayload.items.find((tenant) => tenant.companyId === companyId);
      setActiveRun(currentTenant?.lastRun ?? null);
    } catch (loadError) {
      if (!signal?.aborted) {
        setError(toErrorMessage(loadError));
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [companyId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadState(controller.signal);
    return () => controller.abort();
  }, [loadState]);

  useEffect(() => {
    if (!isRunActive || !activeRun?.id) {
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      void getDemoSimulationRun(activeRun.id, controller.signal)
        .then((payload) => setActiveRun(payload.run))
        .catch((pollError) => setError(toErrorMessage(pollError)));
    }, 1500);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [activeRun?.id, isRunActive]);

  const saveProfile = useCallback(async () => {
    if (!isProfileValidJson || !parsedProfile) {
      setError('프로파일 JSON 형식이 올바르지 않습니다.');
      return;
    }
    setIsSaving(true);
    setError(null);
    setValidationErrors([]);
    try {
      const payload = await saveDemoSimulationProfile(companyId, parsedProfile);
      setSavedProfile(payload.profile);
      setProfileDraft(formatJson(payload.profile));
      setProfileSource('saved');
      toast.success('시뮬레이션 파라미터를 저장했습니다.');
    } catch (saveError) {
      setValidationErrors(toValidationErrors(saveError));
      setError(toErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }, [companyId, isProfileValidJson, parsedProfile]);

  const loadDefaultProfile = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setValidationErrors([]);
    try {
      const payload = await getDefaultDemoSimulationProfile(companyId);
      setProfileDraft(formatJson(payload.profile));
      toast.info('기본 파라미터를 편집창에 불러왔습니다. 저장해야 반영됩니다.');
    } catch (loadError) {
      setError(toErrorMessage(loadError));
    } finally {
      setIsSaving(false);
    }
  }, [companyId]);

  const startRun = useCallback(async (mode: DemoSimulationRunMode) => {
    if (!isProfileValidJson) {
      setError('프로파일 JSON 형식이 올바르지 않습니다.');
      return;
    }
    if (hasUnsavedChanges) {
      setError('저장되지 않은 시뮬레이션 파라미터가 있습니다. 저장 후 실행해 주세요.');
      return;
    }
    if (mode === 'reset_generate' && !canReset) {
      setError('초기화 생성은 companyId를 확인 문구로 정확히 입력해야 실행할 수 있습니다.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = await startDemoSimulationRun({
        companyId,
        mode,
        seed,
        resetConfirmed: mode === 'reset_generate',
        async: true,
      });
      setActiveRun(payload.run);
      toast.success('데모 시뮬레이션 실행을 시작했습니다.');
    } catch (submitError) {
      setValidationErrors(toValidationErrors(submitError));
      setError(toErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }, [canReset, companyId, hasUnsavedChanges, isProfileValidJson, seed]);

  const latestCounts = activeRun?.createdCounts ?? null;

  return (
    <Layout title="데모 시뮬레이션 관리">
      <PageStateBoundary
        isLoading={isLoading}
        error={error}
        onRetry={() => { void loadState(); }}
        loadingTitle="데모 시뮬레이션 설정을 불러오는 중입니다"
      >
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-600">Super Admin Only</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">데모 테넌트 데이터 생성</h2>
                <p className="mt-2 text-sm text-slate-600">
                  저장된 파라미터를 기준으로 v2 시뮬레이터가 데이터를 bulk 생성하고 생성 결과를 검증합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { void loadState(); }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                새로고침
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">데모 테넌트 ID</span>
                <input
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value.trim())}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Seed</span>
                <input
                  type="number"
                  value={seed}
                  onChange={(event) => setSeed(Number(event.target.value) || seed)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">초기화 확인 문구</span>
                <input
                  value={resetText}
                  onChange={(event) => setResetText(event.target.value)}
                  placeholder={companyId}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => { void startRun('advance'); }}
                disabled={!canRun}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting || isRunActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                날짜 진행/미래 예약 보충
              </button>
              <button
                type="button"
                onClick={() => { void startRun('reset_generate'); }}
                disabled={!canRun || !canReset}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RotateCcw className="h-4 w-4" />
                초기화 후 생성
              </button>
              {hasUnsavedChanges && <span className="text-sm font-semibold text-amber-700">저장되지 않은 변경사항이 있습니다.</span>}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-slate-600" />
                  <h3 className="text-lg font-bold text-slate-900">시뮬레이션 파라미터</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{profileSource === 'saved' ? '저장됨' : '기본값'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setProfileDraft(savedProfileText)}
                    disabled={!hasUnsavedChanges || isSaving}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Undo2 className="h-4 w-4" />
                    저장 취소
                  </button>
                  <button
                    type="button"
                    onClick={() => { void loadDefaultProfile(); }}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    기본값 불러오기
                  </button>
                  <button
                    type="button"
                    onClick={() => { void saveProfile(); }}
                    disabled={isSaving || !isProfileValidJson || !hasUnsavedChanges}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    저장
                  </button>
                </div>
              </div>
              <textarea
                value={profileDraft}
                onChange={(event) => {
                  setProfileDraft(event.target.value);
                  setValidationErrors([]);
                }}
                className={`min-h-[520px] w-full rounded-xl border px-4 py-3 font-mono text-xs leading-5 focus:outline-none focus:ring-2 ${isProfileValidJson ? 'border-slate-300 focus:border-blue-500 focus:ring-blue-100' : 'border-red-300 focus:border-red-500 focus:ring-red-100'}`}
                spellCheck={false}
              />
              {!isProfileValidJson && <p className="mt-2 text-sm font-medium text-red-600">JSON 형식이 올바르지 않습니다.</p>}
              {validationErrors.length > 0 && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-bold text-red-700">파라미터 유효성 검증 실패</p>
                  <ul className="mt-2 space-y-1 text-sm text-red-700">
                    {validationErrors.map((validationError, index) => <li key={`${validationError.path ?? index}`}>{validationErrorLabel(validationError)}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">최근 실행 상태</h3>
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(activeRun?.status)}`}>
                      {statusLabel(activeRun?.status)}
                    </span>
                    {isRunActive && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, activeRun?.progress ?? 0))}%` }} />
                  </div>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">단계</dt><dd className="font-semibold text-slate-900">{activeRun?.stage ?? '-'}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">마지막 시뮬레이션 날짜</dt><dd className="font-semibold text-slate-900">{activeRun?.lastSimulatedDate ?? '-'}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">소요시간</dt><dd className="font-semibold text-slate-900">{activeRun?.durationMs ? `${activeRun.durationMs}ms` : '-'}</dd></div>
                  </dl>
                  {activeRun?.error?.message && (
                    <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      {activeRun.error.message}
                    </div>
                  )}
                </div>
                {latestCounts && (
                  <pre className="mt-4 max-h-44 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{formatJson(latestCounts)}</pre>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">검증 결과</h3>
                <div className="mt-4 space-y-2">
                  {(activeRun?.validationSummary?.checks ?? []).map((check) => (
                    <div key={check.name} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                      <span className="font-medium text-slate-700">{check.name}</span>
                      {check.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-red-600" />}
                    </div>
                  ))}
                  {!activeRun?.validationSummary?.checks?.length && <p className="text-sm text-slate-500">아직 검증 결과가 없습니다.</p>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">데모 테넌트</h3>
                <div className="mt-4 space-y-2">
                  {tenants.map((tenant) => (
                    <button
                      key={tenant.companyId}
                      type="button"
                      onClick={() => setCompanyId(tenant.companyId)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="font-semibold text-slate-900">{tenant.name}</span>
                      <span className="ml-2 text-slate-500">{tenant.companyId}</span>
                    </button>
                  ))}
                  {!tenants.length && <p className="text-sm text-slate-500">등록된 데모 테넌트가 없습니다.</p>}
                </div>
              </div>
            </div>
          </section>
        </div>
      </PageStateBoundary>
    </Layout>
  );
}
