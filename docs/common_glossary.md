# FE-BE Common Glossary (BK-001)

- Last Updated: 2026-02-25
- Scope: `pangea-front`, `_legacy/Project_Prometheus_BE`
- Source Ticket: `SCRUM-22` (`[BK-001] FE-BE 공통 용어집 확정`)

## 1. Purpose
- FE/BE 계약에서 혼용되던 핵심 용어를 단일 기준으로 고정한다.
- BK-002(OpenAPI v2 초안), BK-020(FE API 클라이언트), BK-040~ 이후 도메인 연동 작업의 기준점으로 사용한다.

## 2. Canonical Terms

| Domain | Canonical Term | Type | Definition | Alias / Legacy | Rule |
|---|---|---|---|---|---|
| Vehicle | `vehicleNumber` | string | 차량번호(번호판) 표시/검색에 쓰는 기본 식별자 | `plate`, `carNumber` | FE 화면/쿼리/리스트 키는 기본적으로 `vehicleNumber` 사용 |
| Vehicle | `plate` | string | 레거시 또는 외부 시스템에서 전달되는 번호판 원문 필드 | `vehicleNumber` | API 경계에서 `plate -> vehicleNumber` 매핑 후 FE 내부는 `vehicleNumber`로 통일 |
| Vehicle | `vin` | string | 차대번호(Vehicle Identification Number), 차량 고유 식별자 | - | `vin`은 `vehicleNumber`와 대체 불가, 별도 필드 유지 |
| Contract | `reservation` | enum value | 계약 시작 전 예약 상태 | `booked` | 예약 건은 `type="reservation"`으로 고정 |
| Contract | `rental` | enum value | 실제 대여 진행 상태 | `activeRental` | 대여 진행 건은 `type="rental"`으로 고정 |
| Contract | `return` | enum value | 반납 완료 상태 | `returned` | 반납 완료 건은 `type="return"`으로 고정 |

## 3. Status Rule (Domain-Scoped)

`status`는 단일 전역 의미로 쓰지 않는다. 반드시 도메인 컨텍스트와 함께 사용한다.

| Domain Context | Field | Allowed Values |
|---|---|---|
| Vehicle 상태 | `vehicle.status` | `"대여중" | "예약" | "가용" | "정비중"` |
| 계약 유형 | `reservation.type` | `"reservation" | "rental" | "return"` |
| 조치 항목 | `actionItem.status` | `"pending" | "in-progress" | "resolved"` |
| 결제 상태 | `payment.status` | `"대기" | "완료" | "미납" | "부분납부"` |

보정 규칙:
- 레거시 입력 `"예약됨"`은 `"예약"`으로 정규화한다.
- 문맥 없는 `status` 단독 비교를 지양하고, 타입/DTO 명으로 도메인을 분리한다.

## 4. Mapping Policy

### 4.1 Vehicle Identifier
```json
{
  "plate": "12가3456",
  "vin": "KMHXX00XXXX000000"
}
```

```json
{
  "vehicleNumber": "12가3456",
  "vin": "KMHXX00XXXX000000"
}
```

### 4.2 Reservation Type
```json
{
  "type": "reservation"
}
```

```json
{
  "type": "rental"
}
```

## 5. Naming Do / Don’t

Do:
- `vehicleNumber`, `vin`, `reservation.type`, `payment.status`
- 도메인 의미가 드러나는 타입명 사용 (`VehicleStatus`, `ReservationType` 등)

Don’t:
- `carNo`, `car_num`, `rentalStatus`(문맥 불명확), `statusValue`(도메인 누락)
- `plate`와 `vehicleNumber` 혼용 저장

## 6. Change Control
- 신규 API/DTO 추가 시 이 문서 기준 용어를 우선 적용한다.
- 변경 필요 시 BK 티켓으로 사전 합의 후 이 문서부터 갱신한다.
