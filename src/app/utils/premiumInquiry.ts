import type { NavigateFunction } from 'react-router';

export type PremiumInquirySource = 'home-modal' | 'layout-banner' | 'vehicle-detail-modal';

export interface SupportPrefillState {
  category: string;
  title: string;
  content: string;
}

export interface SupportCenterLocationState {
  supportPrefill: SupportPrefillState;
}

const PREMIUM_INQUIRY_CATEGORY = '프리미엄 단말 문의';

const PREMIUM_INQUIRY_PREFILLS: Record<PremiumInquirySource, Omit<SupportPrefillState, 'category'>> = {
  'home-modal': {
    title: '프리미엄 단말 도입 상담 요청',
    content: '홈 대시보드 프리미엄 CTA에서 단말 도입 상담을 요청합니다.',
  },
  'layout-banner': {
    title: '프리미엄 단말 기능 상담 요청',
    content: '상단 프리미엄 배너에서 단말 기능과 도입 상담을 요청합니다.',
  },
  'vehicle-detail-modal': {
    title: '차량 단말 업그레이드 상담 요청',
    content: '차량 상세 모달에서 프리미엄 단말 업그레이드 상담을 요청합니다.',
  },
};

export function buildPremiumInquiryLocationState(
  source: PremiumInquirySource,
): SupportCenterLocationState {
  return {
    supportPrefill: {
      category: PREMIUM_INQUIRY_CATEGORY,
      ...PREMIUM_INQUIRY_PREFILLS[source],
    },
  };
}

export function navigateToPremiumInquiry(
  navigate: NavigateFunction,
  source: PremiumInquirySource,
): void {
  navigate('/support-center', {
    state: buildPremiumInquiryLocationState(source),
  });
}
