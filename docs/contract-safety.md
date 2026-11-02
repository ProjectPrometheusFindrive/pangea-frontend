# Contract safety scoring UI

`/contract-safety` is available with reservation read permission; installer access is denied. Super admins select a company by name; admins/members use their own tenant. Score settings and event/Trip exclusions are admin/super-admin-only at both UI and API layers.

The score belongs to the rental contract and is displayed under its representative. All permitted drivers contribute; it is not a claim of individual-driver identification. The default per-contract minimum is 300km, with a five-minute return settlement wait. Settings changes affect newly created contracts only. Old contracts explicitly show “적용 전 계약”.

The approved formula weights harsh acceleration/braking/cornering 20% each, speeding 40%. The UI shows final/provisional, insufficient-distance, sync-pending and data-review states, frozen policy, events/Trips, KST Trip-start-month references and recent score/exclusion audit. Overall scores remain blank below the minimum or with incomplete evidence. Entire staff Trips may be excluded with reason; their distance and contained events are removed too. Restore requires a reason.

No discount, refund, billing or eligibility logic is included. See the BE `docs/features/contract-safety.md` for source qualifications, exact formulas, endpoint contracts and return watermark semantics.

Validation: `npm run build`; seven interaction E2E tests in `e2e/contract-safety.spec.ts`. `e2e/contract-safety-live.spec.ts` is opt-in with `E2E_SAFETY_LIVE=1` and the BE disposable localhost fixture; it must never target production.

Demo simulation uses final aggregate examples and the same approved formula. Score rows show a demo/scenario label, a notice identifies fictional input, and detail shows aggregate counts/components/monthly references rather than nonexistent individual raw records. The super-admin simulation page reports the number of generated safety assessments. Reset/regeneration automatically replaces the demo scores/history/exclusions; real tenant scoring is unchanged.

Detail opens in an accessible right-side dialog, full width on mobile. Closing via the button/Escape retains the list page, filters and scroll, and restores focus to the opening row. Opening/closing does not refetch the list. Deep-linked detail failures are shown inside the panel.

Filters cover inclusive KST dates overlapping actual custody, distance (km), driving hours and assessment status. Date filtering selects whole contracts; it does not change a contract's scoring period or recalculate partial-period scores. Apply/reset controls validate ranges and reset pagination. Applied conditions and sort are retained in URL parameters when detail opens/closes.

Sorting supports newest, score high/low, distance and driving hours. Filtering/sorting run on the entire tenant in the API before 20-row pagination, with filtered/total counts displayed. Unscored contracts remain last in either score order. Exclusions refresh the filtered ordering. No formula or discount change is included.
