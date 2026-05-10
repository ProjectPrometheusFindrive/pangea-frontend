export type ActionMainCategory =
  | '정산/수납'
  | '반납/회수'
  | '대여 중 사고'
  | '대차/보험청구'
  | '차량 의무관리'
  | '차량이상'
  | '단말 OFF'
  | '도난 의심';

export const ACTION_MAIN_CATEGORIES: ActionMainCategory[] = [
  '정산/수납',
  '반납/회수',
  '대여 중 사고',
  '대차/보험청구',
  '차량 의무관리',
  '차량이상',
  '단말 OFF',
  '도난 의심',
];

export const ACTION_SUBCATEGORIES_BY_CATEGORY: Record<ActionMainCategory, string[]> = {
  '정산/수납': [
    '월 렌트료 납부 예정',
    '월 렌트료 연체',
    '추가요금 미수',
    '보증금 반환',
    '고객부담금 수납',
    '미납 결제 확인',
  ],
  '반납/회수': ['차량 반납/회수 확인', '종료 정산 필요'],
  '대여 중 사고': ['대여 중 사고 후속 처리'],
  '대차/보험청구': [
    '사고정보 입력 필요',
    '운전자/면허 정보 입력 필요',
    '대차 승인 확인',
    '보험청구 제출/보완',
    '보험금 정산 확인',
    '고객부담금 수납',
  ],
  '차량 의무관리': ['보험 만료 임박', '정기점검 만료 임박'],
  차량이상: ['차량이상'],
  '단말 OFF': ['단말 OFF'],
  '도난 의심': ['도난 의심'],
};

function compact(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(/-/g, '_');
}

export function normalizeActionMainCategory(
  value: string | null | undefined,
  paymentInfoPresent = false,
): ActionMainCategory | null {
  const raw = (value ?? '').trim();
  const token = compact(raw);
  if (!token) {
    return paymentInfoPresent ? '정산/수납' : null;
  }
  if ((ACTION_MAIN_CATEGORIES as string[]).includes(raw)) {
    return raw as ActionMainCategory;
  }
  if (token.includes('미납') || token.includes('결제') || token.includes('연체') || token.includes('수납') || token.includes('정산')) {
    return '정산/수납';
  }
  if (token.includes('반납지연') || token.includes('회수') || token.includes('반납')) {
    return '반납/회수';
  }
  if (token.includes('대차') || token.includes('보험청구') || token.includes('보험금') || token.includes('청구서류')) {
    return '대차/보험청구';
  }
  if (token.includes('사고접수') || (token.includes('사고') && !token.includes('대차'))) {
    return '대여 중 사고';
  }
  if (token.includes('보험만료') || token.includes('정기점검') || token.includes('의무관리')) {
    return '차량 의무관리';
  }
  if (token.includes('차량이상')) {
    return '차량이상';
  }
  if (token.includes('단말') && token.includes('off')) {
    return '단말 OFF';
  }
  if (token.includes('도난')) {
    return '도난 의심';
  }
  return null;
}

export function normalizeActionSubCategory(
  category: string | null | undefined,
  subCategory?: string | null,
  reasonType?: string | null,
): string | null {
  const explicit = (subCategory ?? '').trim();
  if (explicit) {
    const canonicalSubCategory: Record<string, string> = {
      '단기/장기 렌트 고객 사고 접수': '대여 중 사고 후속 처리',
      사고자료확인: '대여 중 사고 후속 처리',
      보험처리확인: '대여 중 사고 후속 처리',
      '보험청구 서류 준비': '보험청구 제출/보완',
      보험청구지연: '보험청구 제출/보완',
      '보험금 입금 확인': '보험금 정산 확인',
      '대차료 차액 발생': '보험금 정산 확인',
      '반납 지연': '차량 반납/회수 확인',
      '수리완료 후 미반납': '차량 반납/회수 확인',
    };
    return canonicalSubCategory[explicit] ?? canonicalSubCategory[compact(explicit)] ?? explicit;
  }
  const reasonMap: Record<string, string> = {
    long_term_monthly_due: '월 렌트료 납부 예정',
    long_term_monthly_overdue: '월 렌트료 연체',
    late_return: '차량 반납/회수 확인',
    accident_replacement_repair_done_not_returned: '차량 반납/회수 확인',
    return_followup_required: '차량 반납/회수 확인',
    accident_replacement_info_missing: '사고정보 입력 필요',
    accident_claim_documents_required: '보험청구 제출/보완',
    accident_claim_submission_required: '보험청구 제출/보완',
    accident_claim_payment_check: '보험금 정산 확인',
    accident_claim_difference: '보험금 정산 확인',
    accident_claim_settlement_required: '보험금 정산 확인',
    accident_replacement_driver_license_required: '운전자/면허 정보 입력 필요',
    accident_replacement_driver_required: '운전자/면허 정보 입력 필요',
    accident_replacement_license_required: '운전자/면허 정보 입력 필요',
    accident_replacement_approval_required: '대차 승인 확인',
    accident_claim_delayed: '보험청구 제출/보완',
    accident_customer_deductible_due: '고객부담금 수납',
    rental_accident_reported: '대여 중 사고 후속 처리',
    rental_accident_followup: '대여 중 사고 후속 처리',
    rental_accident_evidence_required: '대여 중 사고 후속 처리',
    rental_accident_insurance_processing: '대여 중 사고 후속 처리',
  };
  const reason = (reasonType ?? '').trim();
  if (reason && reasonMap[reason]) {
    return reasonMap[reason];
  }
  const raw = (category ?? '').trim();
  const token = compact(raw);
  if (token.includes('보험만료')) {
    return '보험 만료 임박';
  }
  if (token.includes('정기점검')) {
    return '정기점검 만료 임박';
  }
  if (token.includes('사고접수')) {
    return '대여 중 사고 후속 처리';
  }
  if (token.includes('미납') || token.includes('결제')) {
    return '미납 결제 확인';
  }
  if (token.includes('반납지연') || token.includes('수리완료후미반납') || token.includes('반납회수')) {
    return '차량 반납/회수 확인';
  }
  return raw && !(ACTION_MAIN_CATEGORIES as string[]).includes(raw) ? raw : null;
}
