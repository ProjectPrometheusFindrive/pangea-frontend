import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '../../services/api';
import { getCompany, patchCompany, type Company, type CompanyUpdateRequest } from '../../services/company';
import { useAuth } from './AuthContext';

interface CompanyContextType {
  company: Company | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  refreshCompany: () => Promise<void>;
  updateCompany: (payload: CompanyUpdateRequest) => Promise<Company>;
}

const COMPANY_CACHE_KEY = 'pangea.company.v1';

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCompany(value: unknown): value is Company {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.businessNumber === 'string'
    && typeof value.address === 'string'
    && (value.contactName === undefined || typeof value.contactName === 'string')
    && (value.contactPhone === undefined || typeof value.contactPhone === 'string')
  );
}

function readCachedCompany(): Company | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(COMPANY_CACHE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    return isCompany(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function writeCachedCompany(company: Company): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(company));
  } catch {
    // localStorage 접근이 제한된 환경에서는 캐시를 건너뛴다.
  }
}

function clearCachedCompany(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(COMPANY_CACHE_KEY);
  } catch {
    // localStorage 접근이 제한된 환경에서는 캐시 제거를 건너뛴다.
  }
}

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError && error.message) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallbackMessage;
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const {
    status: authStatus,
    isBootstrapping: isAuthBootstrapping,
    isAuthenticated,
    viewRole,
  } = useAuth();
  const [company, setCompany] = useState<Company | null>(() => readCachedCompany());
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCompany = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextCompany = await getCompany();
      setCompany(nextCompany);
      writeCachedCompany(nextCompany);
    } catch (refreshError) {
      const cachedCompany = readCachedCompany();
      setCompany(cachedCompany);
      setError(toErrorMessage(refreshError, '회사 정보를 불러오지 못했습니다.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateCompany = useCallback(async (payload: CompanyUpdateRequest) => {
    setIsUpdating(true);
    setError(null);

    try {
      const updatedCompany = await patchCompany(payload);
      setCompany(updatedCompany);
      writeCachedCompany(updatedCompany);
      return updatedCompany;
    } catch (updateError) {
      setError(toErrorMessage(updateError, '회사 정보를 저장하지 못했습니다.'));
      throw updateError;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'checking' || isAuthBootstrapping) {
      return;
    }

    if (!isAuthenticated) {
      setCompany(null);
      setError(null);
      setIsLoading(false);
      clearCachedCompany();
      return;
    }

    if (viewRole === 'device-installer') {
      setCompany(null);
      setError(null);
      setIsLoading(false);
      clearCachedCompany();
      return;
    }

    void refreshCompany();
  }, [authStatus, isAuthBootstrapping, isAuthenticated, refreshCompany, viewRole]);

  const contextValue = useMemo<CompanyContextType>(() => ({
    company,
    isLoading,
    isUpdating,
    error,
    refreshCompany,
    updateCompany,
  }), [company, error, isLoading, isUpdating, refreshCompany, updateCompany]);

  return (
    <CompanyContext.Provider value={contextValue}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextType {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
