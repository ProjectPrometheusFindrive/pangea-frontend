# Prompt Library v1

- Version: v1.2.46
- Date: 2026-03-07
- Owner: Pangea Frontend Team
- Tags: prompt-library,workflow,branch-policy,history-policy,commit-policy,pr-automation,jira-traceability,end-prompt-protocol,worktree-cleanup,jira-status-sync,jira-comment-sync,ac-evidence,mock-removal,reservations-write,reservations-mock-removal,ocr-flow,revenue-api,settings-api,payment-status-sync,home-api,home-summary,home-copy,i18n-regression,action-payment-mock-removal,support-center,rbac-permission-hardening,e2e-test-hardening,playwright-artifact-policy,device-installation-tenant-scope,authorization-loading-guard,auth-silent-refresh

## Context
- 珥덇린 ?명똿 ?묒뾽?먯꽌 ?꾨＼?꾪듃 ?쒗뵆由? 釉뚮옖移??뺤콉, 臾몄꽌???덉감瑜?諛섎났 媛?ν븯寃??쒖??뷀븷 ?꾩슂媛 ?덉쓬.

## Goal
- Start/End Prompt瑜?湲곗??쇰줈 ?묒뾽 ?ы쁽???뺣낫.
- `dev -> production` 釉뚮옖移??댁쁺 ?뺤콉怨?臾몄꽌??洹쒖튃???쇨??섍쾶 ?곸슜.
- ?묒뾽 湲곕줉(`prompt_history`)怨??ъ궗???쒗뵆由?`prompt_library`)???곌껐 怨좎젙.
- ?몄뀡 ?쒖옉 ?쒖젏??`Start Prompt` ?묒뾽遺꾩쓣 ?쇱씠釉뚮윭由ъ? 遺꾨━???덉뒪?좊━??蹂댁〈.
- 臾몄꽌 ?묒뾽 醫낅즺 ??`Push` 諛??쒓? `PR` ?앹꽦源뚯? ?먮룞??
- PR ?앹꽦 吏곹썑 ?뚰겕?몃━ ?뺣━? Jira ?곹깭(`Resolved`) ?꾪솚源뚯? 醫낅즺 ?덉감瑜?紐낆떆.
- Jira ?곗폆 ?묒뾽 醫낅즺 ???듭떖 蹂寃??뱀씠?ы빆??Jira 肄붾찘?몃줈 ?④꺼 PR-?댁뒋 異붿쟻?깆쓣 蹂닿컯.

## Documentation Scope
- ???臾몄꽌: `docs/prompt_library/prompt_library_v1.md` (?꾩쟻 愿由? ?좉퇋 v2/v3 ?뚯씪 ?앹꽦 湲덉?)
- ?대젰 臾몄꽌: `docs/prompt_history/{YYYYMMDD}_{TICKET-ID}-{slug}.md` (?묒뾽 1嫄대떦 1?뚯씪)
- 蹂??뚰겕?뚮줈???섑뻾 ??肄붾뱶 蹂寃??놁씠 臾몄꽌 踰붿쐞濡??쒖젙 媛?ν빐????

## Version Policy

| 蹂寃?踰붿쐞 | ?덉떆 | 踰꾩쟾 蹂??|
|---|---|---|
| 援ъ“???뱀뀡 異붽? | ?덈줈??API Design Spec 異붽? | +0.1 (minor) |
| ?몃? ?댁슜 ?섏젙 | Blueprint Helper 臾몄옣 ?섏젙 | +0.0.1 (patch) |
| ?꾩껜 由ы뙥?곕쭅 | 援ъ“ ?ы렪, TOC 蹂寃?| +1.0 (major) |

## System Prompt
```text
Follow repository AGENTS.md and keep changes minimal and precise.
Do not run destructive git commands. Respect branch policy: dev for integration, production for release.
```

## Developer Prompt (optional)
```text
Use rg for impact search.
Create a short execution plan before substantial edits.
For API changes, update docs/ together with code.
```

## User Prompt (canonical)
```text
Purpose: prompt_library and prompt_history documentation + automation (Push & PR)
Start Prompt work items must be recorded in prompt_history separately from prompt_library.

Start Prompt:
- Base branch: dev
- Work only through PR into dev
- Do not use main branch

End Prompt:
- Update docs/prompt_library/prompt_library_v1.md version metadata
- Add docs/prompt_history/{YYYYMMDD}_{TICKET-ID}-{task-summary}.md from template
- Commit step: do not run push/tag/rebase/reset
- Then run git push and create PR to dev in Korean (UTF-8)
```

## Prompt History Naming Rules
- ?뺤떇: `{YYYYMMDD}_{TICKET-ID}-{slug}.md`
- slug 洹쒖튃: lower-kebab-case, ASCII `[a-z0-9-]`, 3~8 ?⑥뼱
- ?덉떆: `20260225_BK-003-bootstrap-branch-policy.md`
- Jira ?곗폆???녿뒗 ?묒뾽? `{TICKET-ID}`瑜?`NO-JIRA`濡??쒓린
  - ?덉떆: `20260225_NO-JIRA-planning-backlog-mcp-registration.md`

## Prompt History Capture Rules
- `prompt_history`??理쒖냼 ?뱀뀡 `## Start Context`, `## Changes Summary`, `## Diffs & Files`, `## Notes`瑜??ы븿?쒕떎.
- `Start Context`?먮뒗 Start Prompt ?듭떖 議곌굔怨?Jira 二쇱슂 ?붽뎄?ы빆(AC/?쒖빟)???④퍡 ?붿빟?쒕떎.
- `Changes Summary`?먮뒗 ?ㅼ젣 諛섏쁺 寃곌낵瑜?踰붿쐞蹂꾨줈 湲곗닠?섍퀬, `Diffs & Files`?먮뒗 二쇱슂 ?섏젙 ?뚯씪??紐낆떆?쒕떎.
- 肄붾뱶 蹂寃쎌씠 ?ы븿??Jira ?곗폆? AC ??ぉ蹂?援ы쁽 洹쇨굅(?뚯씪/?⑥닔 湲곗?)瑜?`Changes Summary` ?먮뒗 `Diffs & Files`??諛섎뱶???④릿??
- Assets 議고쉶 ?곕룞 ?곗폆(BK-042 怨꾩뿴)? `prompt_history`??`page/size/status/q` 荑쇰━?ㅽ듃留?API ?뚮씪誘명꽣 ?숆린?붿? `400/401/403/404/5xx` 遺꾧린 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- Assets ?곌린 ?곕룞 ?곗폆(BK-043/SCRUM-39 怨꾩뿴)? `prompt_history`??create/patch/history ?곕룞, dirty/saving/以묐났 ?쒖텧 諛⑹?, `400 ?꾨뱶 ?ㅻ쪟/403 沅뚰븳/409 異⑸룎(?낅젰 蹂댁〈)/5xx ?ъ떆???좎뒪?? 遺꾧린 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- Reservations 議고쉶 ?곕룞 ?곗폆(BK-052/SCRUM-43 怨꾩뿴)? `prompt_history`??`page/size/status/from/to` URL-API ?뚮씪誘명꽣 ?숆린?? 紐⑸줉/?곸꽭 race-safe 議고쉶, `from>to` 寃利? `400/401/403/404/5xx` 遺꾧린 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- Reservations ?곌린 ?곕룞 ?곗폆(BK-053/SCRUM-44 怨꾩뿴)? `prompt_history`??create/return/accident API ?곕룞, ?쒖텧 以?以묐났 ?쒖텧 諛⑹?, ?앹꽦 ?깃났 ???곸꽭 ID ?숆린?? `400 ?꾨뱶/???ㅻ쪟쨌403 沅뚰븳쨌409 ?곹깭異⑸룎쨌5xx ?ъ떆???좎뒪?? 遺꾧린 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- OCR ?곕룞 ?곗폆(BK-085/SCRUM-64 怨꾩뿴)? `prompt_history`??`assets/upload -> ocr/extract -> ocr/jobs/{jobId}` ?먮쫫, polling ?곹깭 ?꾪솚(泥섎━以?蹂듦?), partial prefill 泥섎━, re-upload ???댁쟾 OCR ?쒖븞 ?먭린, `400/413 ?뚯씪 ?ㅻ쪟쨌5xx/timeout ?ъ떆?꽷룹닔???낅젰 fallback` 遺꾧린 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- Revenue API ?곕룞 ?곗폆(BK-074/SCRUM-56 怨꾩뿴)? `prompt_history`??`/api/v2/revenue/summary(from,to,granularity)` 諛?`/api/v2/revenue/trend(from,to)` ?뚮씪誘명꽣 ?숆린?? 湲곌컙/?⑥쐞 蹂寃???loading 媛깆떊, empty-state, `400/401/403/5xx+network` 遺꾧린? Retry/?댁쟾 ?ㅻ깄??蹂듭썝 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- Home API ?곕룞 ?곗폆(BK-073/SCRUM-55 怨꾩뿴)? `prompt_history`??`/api/v2/home/summary(from,to,tenantId)` ?뚮씪誘명꽣 ?숆린?? 湲곌컙 ?꾪꽣 蹂寃??ъ“?? `loading/empty/401/403/5xx+network` 遺꾧린, race-safe ?붿껌 泥섎━? ?ъ“???ㅽ뙣 ???댁쟾 ?ㅻ깄???좎? 洹쇨굅, null-safe 湲곕낯媛??뚮뜑 諛?Home ?고???mock 寃쎈줈 ?쒓굅 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- Home KPI ?꾩냽 ?곗폆(SCRUM-183 怨꾩뿴)? `prompt_history`??`alerts.overdue`(諛섎궔 吏??)??`kpis.unpaidContracts`(誘몃궔/?곗껜 怨꾩빟) 遺꾩쓣 ?④퍡 湲곕줉?섍퀬, Home -> Reservations ?대룞 ???쇰줈 `paymentScope=delinquent` ?뚮뜑 ?숈씪 踰붿쐞濡??곌퀎?섏뿬 card/count/list 媛믪씠 ?쇱튂?섎뒗吏 蹂닿컯 ?뚯뒪??洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- Home copy/i18n regression tickets (SCRUM-185 series) must record the exact localized string replacement, the rendered surface where the copy changed, and regression evidence that the Korean label is shown instead of the legacy English text. If Playwright reuses a running dev server, record whether `127.0.0.1:4173` was free or an isolated-port workaround was required.
- Settings API ?곕룞 ?곗폆(BK-075/SCRUM-57 怨꾩뿴)? `prompt_history`??company/geofences/members API ?곌껐 洹쇨굅, ?뚯궗 ?뺣낫 dirty-check/遺遺??낅뜲?댄듃(schemaVersion ?ы븿)/????곹깭 遺꾧린, 沅뚰븳 湲곕컲 ?쎄린?꾩슜 泥섎━, `400 ?꾨뱶 ?ㅻ쪟쨌403 沅뚰븳쨌409 異⑸룎 ?щ줈?㈑?xx+network ?ъ떆??, ???誘몄????곹깭 ?댄깉 寃쎄퀬(beforeunload) 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- 怨좉컼?쇳꽣 UI/?곕룞 ?곗폆(BK-087/SCRUM-66 怨꾩뿴)? `prompt_history`??`/api/v2/support/categories`, `/api/v2/support/tickets`, `/api/v2/support/tickets/{ticketId}` ?곕룞 洹쇨굅, 移댄뀒怨좊━ loading/empty/吏곸젒?낅젰 遺꾧린, 臾몄쓽 submitting/以묐났 ?쒖텧 諛⑹?/?깃났 ticketId 蹂듦뎄, `400/401/403/5xx+network` 遺꾧린? Retry/沅뚰븳 ?≪뀡, 泥⑤??뚯씪 ?⑸웾 ?쒗븳 ?뺤콉 諛섏쁺 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- ??븷 湲곕컲 硫붾돱/沅뚰븳 ?섎뱶???곗폆(BK-076/SCRUM-58 怨꾩뿴)? `prompt_history`??`/api/v2/auth/me` + `/api/v2/permissions/me` 沅뚰븳 ?뚯뒪 ?듯빀 洹쇨굅, 硫붾돱/?쇱슦???≪뀡 沅뚰븳 ???쇨??? `401/403/5xx` 遺꾧린 ??deny-by-default ?뺤콉, role 蹂寃?沅뚰븳 罹먯떆 TTL/?뚮꼳???꾪솚 ???ы룊媛 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- FE E2E 蹂닿컯 ?곗폆(BK-091/SCRUM-69 怨꾩뿴)? `prompt_history`??login/assets/reservations/device-installation ?듭떖 ?뚮줈???뚯뒪??洹쇨굅, `loading->success` assertion, `401/403/5xx` 遺꾧린 assertion, flaky ?쒖뼱媛?retries/timeouts), ?ㅽ뙣 ?곗텧臾?trace/screenshot/video/report) ?섏쭛 ?뺤콉 諛?CI ?뚰겕?뚮줈???곌퀎 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- FE 沅뚰븳 怨꾩빟 ?뺣젹 ?꾩냽 ?곗폆(SCRUM-101~114 ?꾩냽 怨꾩뿴)? `prompt_history`??`/api/v2/permissions/me` 湲곕낯 怨꾩빟(404 誘몄궗?? role蹂?permission payload ?쒓났)怨?`deny-by-default` ?뺤콉 怨듭〈 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- 沅뚰븳 罹먯떆 ?섎뱶???꾩냽 ?곗폆(SCRUM-105 ?꾩냽 怨꾩뿴)? `prompt_history`??`Authorization cache` source瑜?`api`濡??쒗븳?섍퀬 罹먯떆 ??踰꾩쟾 濡ㅼ삤踰꾨줈 legacy `role-fallback` 罹먯떆瑜?臾댄슚?뷀븳 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- Device Installation 怨꾩빟 ?뺣젹 ?꾩냽 ?곗폆(SCRUM-101~114 ?꾩냽 怨꾩뿴)? `prompt_history`??紐⑸줉 議고쉶 mock 寃쎈줈媛 `/api/v2/device-installations/tasks` canonical 寃쎈줈? ?쇱튂?섎뒗吏 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- Device Installation ?ъ쟾議고쉶 tenant-scope ?뚭? ?곗폆(SCRUM-131 怨꾩뿴)? `prompt_history`??pre-check list 議고쉶 ?몄텧??`companyId` ?꾨떖 洹쇨굅(super_admin cross-tenant ?쇳빀 諛⑹?)? non-super_admin ?숈옉 ?좎? 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- ?뚯썝媛???곕룞 ?곗폆(SCRUM-145 怨꾩뿴)? `prompt_history`???쎄? ?숈쓽 ?④퀎(?꾩닔/?좏깮), 以묐났?뺤씤(`/api/v2/auth/check-userid`), 媛???쒖텧(`/api/v2/auth/register` ?곗꽑 + fallback ?뺤콉) 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- Reservations mock ?쒓굅 ?곗폆(BK-054/SCRUM-45 怨꾩뿴)? `prompt_history`??Reservations ?꾨줈?뺤뀡 寃쎈줈??mock import/fixture ?쒓굅 洹쇨굅, v2 reservations endpoint ?⑥씪 ?몄텧 寃쎈줈, API ?ㅽ뙣 ??mock fallback 誘몄궗??洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- Assets mock ?쒓굅 ?곗폆(BK-044/SCRUM-40 怨꾩뿴)? `prompt_history`??Assets ?꾨줈?뺤뀡 寃쎈줈??mock import/flag ?쒓굅 洹쇨굅, v2 assets endpoint ?⑥씪 ?몄텧 寃쎈줈, ?ㅻ쪟 ??mock fallback 誘몄궗??洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- 怨듯넻 ?곹깭 UI ?곗폆(loading/error/empty)? `Validation`??`Retry ?ы샇異?, `401/403/5xx 遺꾧린`, `skeleton/empty CTA` ?뺤씤 洹쇨굅瑜??④퍡 湲곕줉?쒕떎.
- ?몄쬆 而⑦뀓?ㅽ듃 援먯껜 ?곗폆(BK-021/BK-031 怨꾩뿴)? `prompt_history`???몄뀡 ????? API ?좏겙 provider ?곕룞 諛⑹떇, role 留ㅽ븨 洹쒖튃??諛섎뱶??湲곕줉?쒕떎.
- 濡쒓렇??蹂댄샇 ?쇱슦???곗폆(BK-031 怨꾩뿴)? `prompt_history`??`returnUrl` 蹂듦? ?먮쫫, 濡쒓렇??`401/429/NETWORK_ERROR` 遺꾧린, `401 -> /auth/refresh 1??-> ?먯슂泥??ъ떆?? ?쒖꽌瑜?諛섎뱶??湲곕줉?쒕떎.
- ?몄쬆 UX ?뺣━ ?곗폆(BK-032/SCRUM-35 怨꾩뿴)? ?섎룞 濡쒓렇?꾩썐 ?좎뒪?? 留뚮즺 紐⑤떖+`returnUrl` 蹂듦뎄, `401` ?곗뇙 1??醫낅즺, storage ?좏겙 ?뺣━ 洹쇨굅瑜?諛섎뱶??湲곕줉?쒕떎.
- ActionRequired 議고쉶 ?곕룞 ?곗폆(BK-062/SCRUM-48 怨꾩뿴)? 紐⑸줉 荑쇰━(page/size/status/priority/assignee), ?곸꽭 議고쉶(404 fallback), ?꾪꽣 蹂寃?race 諛⑹? 洹쇨굅瑜?諛섎뱶??湲곕줉?쒕떎.
- ActionRequired ?곌린 ?곕룞 ?곗폆(BK-063/SCRUM-49 怨꾩뿴)? ?곹깭 蹂寃??닿껐 ?꾨즺/硫붾え ???API ?곕룞 洹쇨굅, saving 以묐났 ?쒖텧 諛⑹?, ?ㅽ뙣 ???숆????낅뜲?댄듃 濡ㅻ갚, `400/403/409/5xx+network` 遺꾧린? Retry ?쒓났 洹쇨굅, ?곹깭 蹂寃????꾪꽣 ?댄깉 泥섎━ 洹쇨굅瑜?諛섎뱶??湲곕줉?쒕떎.
- 寃곗젣 ?곹깭 ?곕룞 ?듯빀 ?곗폆(BK-064/SCRUM-50 怨꾩뿴)? 寃곗젣 ?곹깭 canonical 留ㅽ븨/?곗꽑?쒖쐞(?ㅼ쨷 寃곗젣/遺遺꾪솚遺?out-of-order timestamp) 洹쇨굅, Reservations/Home/Action ?붾㈃ ?숆린??吏?? `401/403/404/5xx+network` 遺꾧린? last-known fallback + ?ъ떆??UX 洹쇨굅瑜?諛섎뱶??湲곕줉?쒕떎.
- Action/Payment mock ?쒓굅 ?곗폆(BK-065/SCRUM-52 怨꾩뿴)? Action/Payment 寃쎈줈??`mockData`/`mockPayments` ?섏〈 ?쒓굅 洹쇨굅, 寃곗젣 ?곹깭 ?숆린?붽? `/api/v2/payments/status`? `/api/v2/payments/{paymentId}`留??ъ슜?섎룄濡??뺣━??洹쇨굅(`/api/v2/payments` list fallback ?쒓굅 ?ы븿), `401/403/404/5xx` 遺꾧린? Retry, stale ?묐떟 理쒖떊媛?諛섏쁺 洹쇨굅瑜?諛섎뱶??湲곕줉?쒕떎.
- 肄붾뱶 蹂寃쎌씠 ?ы븿??Jira ?곗폆? `Validation` ?뱀뀡??理쒖냼 1媛쒖쓽 ?ㅽ뻾 紐낅졊 寃곌낵(`build` ?먮뒗 `test`)瑜?湲곕줉?쒕떎.
- ????섏젙 ?먮쫫 踰꾧렇 ?곗폆? `Changes Summary` ?먮뒗 `Diffs & Files`???깃났/?ㅽ뙣 遺꾧린 泥섎━ 洹쇨굅(?깃났 ???숈옉, ?ㅽ뙣 ???숈옉)瑜?紐⑤몢 湲곕줉?쒕떎.
- `Notes`?먮뒗 李④린 沅뚯옣 ?쒖뒪?щ쭔 湲곕줉?섎ŉ 利됱떆 諛섏쁺? 湲덉??쒕떎.
- `prompt_library`??怨듭슜 洹쒖튃/?쒗뵆由용쭔 愿由ы븯怨? ?몄뀡 ?뱀씠?ы빆? `prompt_history`??湲곕줉.
- API 怨꾩빟 臾몄꽌(OpenAPI/YAML) 蹂寃???`Validation` ?뱀뀡???ㅽ럺 ?좏슚??寃利?寃곌낵瑜??ы븿?쒕떎.
- FE?먯꽌 API 怨꾩빟 臾몄꽌媛 ?몃? canonical(BE)濡?愿由щ맆 寃쎌슦, FE???щ낯???좎??섏? ?딄퀬 李몄“ 臾몄꽌(?? `docs/api/README.md`)? canonical 留곹겕留??좎??쒕떎.
- Jira ?댁쁺 洹쒖튃(BK-003 怨꾩뿴) 蹂寃???`docs/jira_operating_rules.md`? `planning/06_jira_backlog_breakdown.md`瑜??④퍡 ?숆린?뷀븳??
- `planning/local/06_jira_worktree_parallel_groups.md`瑜?媛깆떊???뚮뒗 Jira ?ㅻ깄??湲곗??쇨낵 ?좉퇋 ?곗폆 踰붿쐞瑜?臾몄꽌 `湲곗?` ?뱀뀡??紐낆떆?쒕떎.
- `planning/local/06_jira_worktree_parallel_groups.md`瑜?媛깆떊???뚮뒗 BK ??ぉ?????`SCRUM` 踰덊샇瑜?蹂묎린?섍퀬 媛???ぉ??Jira browse 留곹겕瑜??ы븿?쒕떎.
- 臾몄꽌/諛깅줈洹?硫뷀??곗씠?곗쓽 BE ??μ냼 ?쒓린??`Project_Prometheus_BE`瑜?canonical濡??ъ슜?섍퀬 legacy ?묐몢 寃쎈줈 ?쒓린???ъ슜?섏? ?딅뒗??

## Inputs
- ?묒뾽 紐⑺몴 ??以?
- 釉뚮옖移??ㅼ씠諛?slug
- 蹂寃??뚯씪 紐⑸줉
- 寃利?紐낅졊 寃곌낵

## Outputs
- ?낅뜲?댄듃??`prompt_library_v1.md`
- ?좉퇋 `prompt_history` 湲곕줉 ?뚯씪 1媛?
- 蹂寃??붿빟(?뱀뀡 ?곹뼢, ?섎룄, 湲곕? ?④낵)

## Usage
```bash
cp docs/prompt_history/_TEMPLATE.md docs/prompt_history/$(date +%Y%m%d)_SCRUM-123-your-task.md
# ?묒뾽 醫낅즺 ??prompt_library_v1.md Version/Date/Version History 媛깆떊
```

## End-of-Task Checklist
- `prompt_library_v1.md` ?곷떒 `Version`/`Date`/`Version History` 媛깆떊
- `docs/prompt_history/_TEMPLATE.md` 湲곕컲 ?대젰 ?뚯씪 異붽?
- `prompt_history`??`Start Prompt` ?듭떖 ?댁슜 諛?諛섏쁺 寃곌낵 ?ы븿
- ?꾩옱 ?묒뾽 釉뚮옖移?`git push` ?섑뻾
- `dev` ????쒓? PR ?앹꽦(UTF-8)
- PR ?앹꽦 ?꾨즺 ??踰좎씠????μ냼?먯꽌 `git worktree remove <worktree-path>` ?섑뻾
- Jira ?곗폆 ?묒뾽?대㈃ PR ?앹꽦 吏곹썑 Jira ?곹깭瑜?`Resolved`濡?蹂寃?(`NO-JIRA` ?묒뾽? ?앸왂 ?ъ쑀 湲곕줉)
- Jira ?곗폆 ?묒뾽?대㈃ ?곹깭 ?꾪솚 吏곹썑 ?듭떖 蹂寃??ы빆/?뱀씠?ы빆/PR 留곹겕瑜?Jira 肄붾찘?몃줈 湲곕줉
- 寃곌낵 異쒕젰???꾨옒 ??ぉ ?ы븿:
  - 蹂寃?異붽????뚯씪
  - 二쇱슂 蹂寃??붿빟
  - ?ㅼ쓬 諛섏쁺 ???釉뚮옖移?(`dev`, PR ???
  - 諛고룷 ?꾩슂 ??(`dev -> production` PR)

## Commit Message Convention
- Subject: `Docs({TICKET-ID}): update prompt_library to vX.Y.Z; add {YYYYMMDD}_{TICKET-ID}-{summary}.md`
- Body: `prompt_history`??`Changes Summary` ?곸쐞 3~5媛?bullet ?붿빟
- 而ㅻ컠 ?④퀎 湲덉?: push / tag / rebase / reset

## Push & PR Convention
- Push: ?꾩옱 ?묒뾽 釉뚮옖移섎? ?먭꺽??諛섏쁺 (`git push -u origin <branch>`)
- PR: `base=dev`濡??앹꽦, ?쒕ぉ/蹂몃Ц? ?쒓? ?묒꽦, UTF-8 ?몄퐫??以??
- Jira ?곗폆???녿뒗 寃쎌슦 PR 蹂몃Ц??`愿???곗폆`?먮뒗 `Jira: ?놁쓬 (NO-JIRA)`濡?紐낆떆
- Cleanup: PR ?앹꽦 ??踰좎씠????μ냼濡??대룞???묒뾽 ?뚰겕?몃━瑜??쒓굅 (`git worktree remove`)
- Jira ?곹깭: ?곗폆???덈뒗 ?묒뾽? PR ?앹꽦 ??`In Progress -> Resolved` ?꾪솚, ?곗폆???녿뒗 ?묒뾽? `NO-JIRA`濡?紐낆떆
- Jira 肄붾찘?? ?곗폆 ?묒뾽? `Resolved` ?꾪솚 吏곹썑 ?듭떖 蹂寃??ы빆, ?뱀씠?ы빆(由ъ뒪??寃利?, PR 留곹겕瑜?肄붾찘?몃줈 ?④릿??
- PR 蹂몃Ц 湲곕낯 ?ы븿 ??ぉ:
  - ?묒뾽 ?붿빟
  - ?곸꽭 蹂寃??댁슜 (Start Prompt 諛섏쁺遺??ы븿)
  - 鍮꾧퀬 (Notes/Follow-ups 李몄“)

## Dependencies & Assumptions
- Default branch: `dev`
- Release branch: `production`
- `main` branch is not used
- `dev`/`production` protected (PR + review required)
- Production push triggers auto tag (`vX.Y.Z`)

## Version History
- v1.2.46 (2026-03-07, SCRUM-185): Add prompt_history evidence rule for Home heading localization regressions, including exact copy replacement and the Playwright reused-server caveat/workaround.
- v1.2.44 (2026-03-03, SCRUM-162): Add prompt_history evidence rule for auth/authorization silent-refresh UX hardening (initial bootstrap-only blocking, focus/visibility background refresh, and no full-screen auth fallback regression checks).
- v1.2.43 (2026-03-03, SCRUM-73): Add prompt_history evidence rule for BK-095 observability baseline (FE `X-Request-Id` propagation via API client interceptor, request/response trace context capture, and Chrome DevTools MCP-based header verification evidence).
- v1.2.45 (2026-03-07, SCRUM-183): Add prompt_history evidence rule for overdue/unpaid split on Home (`kpis.unpaidContracts`, Home->Reservations delinquent scope sync, and label-based Playwright regression coverage).
- v1.2.42 (2026-03-02, SCRUM-132): Add prompt_history evidence rule for Premium installation tenant consistency hardening (single request companyId across pre-check/create/409-recover/refresh, receipt session companyId persistence, and super_admin cross-tenant regression coverage).
- v1.2.41 (2026-03-02, SCRUM-147): Add prompt_history evidence guidance for authorization-loading stuck fixes (user metadata normalization guard, checking-to-ready transition safety, and /auth/me companyId-missing regression coverage).
- v1.2.40 (2026-03-02, SCRUM-145): Add prompt_history evidence rule for legacy-style FE signup flow alignment (?쎄? ?숈쓽 ?④퀎, userId 以묐났?뺤씤, `/api/v2/auth/register` ?곗꽑/fallback ?쒖텧 寃쎈줈 洹쇨굅).
- v1.2.39 (2026-02-28, SCRUM-131): Add prompt_history evidence rule for Device Installation pre-check tenant scope regression (`companyId` ?꾨떖濡?super_admin cross-tenant ?쇳빀 諛⑹? + non-super_admin ?숈옉 ?좎? 洹쇨굅).
- v1.2.38 (2026-02-28, SCRUM-115): Add prompt_history evidence rule for authorization cache source hardening (`role-fallback` source ?쒓굅, cache key/version 濡ㅼ삤踰꾨줈 stale 沅뚰븳 罹먯떆 臾댄슚??.
- v1.2.37 (2026-02-27, SCRUM-101~SCRUM-114): Add prompt_history evidence rule for Device Installation E2E contract alignment (list mock path `/api/v2/device-installations/tasks` canonical ?좎? 洹쇨굅).
- v1.2.36 (2026-02-27, SCRUM-101~SCRUM-114): Add prompt_history evidence rule for FE E2E permission-contract alignment (`/api/v2/permissions/me` default mock 404 ?쒓굅, role蹂?沅뚰븳 payload 諛섑솚?쇰줈 deny-by-default ?뺤콉怨??뚯뒪??怨꾩빟 ?뺣젹).
- v1.2.35 (2026-02-27, SCRUM-101~SCRUM-109/SCRUM-113): Add prompt_history evidence rule for FE follow-up batch fixes (canonical endpoint ?뺣젹: settings/company + action-items + device-installations, permissions ?뚯꽌 硫뷀??곗씠??臾몄옄??李⑤떒 + `*` ??쇰뱶移대뱶 蹂댁〈, Authorization refresh race-safe, ActionRequired ?ㅽ뙣 rollback ?щ룞湲고솕 洹쇨굅).
- v1.2.34 (2026-02-27, SCRUM-69): Add prompt_history evidence rule for BK-091 FE E2E hardening (login/assets/reservations/device-installation flows, loading-success + 401/403/5xx branches, retries/timeouts, and failure artifact policy with CI linkage).
- v1.2.33 (2026-02-27, SCRUM-58): Add prompt_history evidence rule for BK-076 role-based menu/route/action hardening (`/api/v2/auth/me` + `/api/v2/permissions/me` source integration, deny-by-default on 401/403/5xx, role/cache/tenant re-evaluation evidence).
- v1.2.32 (2026-02-27, SCRUM-66): Add prompt_history evidence rule for BK-087 support-center integration (categories/create/detail endpoints, loading-empty-manual-category flow, submit dedupe/receipt restore, 400/401/403/5xx+retry, attachment size policy evidence).
- v1.2.31 (2026-02-27, SCRUM-55): Add prompt_history evidence rule for BK-073 home API integration (`/api/v2/home/summary` param sync, filter requery, loading/error/empty + 401/403/5xx branches, race-safe + snapshot retention, mock path removal evidence).
- v1.2.30 (2026-02-27, SCRUM-52): Add prompt_history evidence rule for BK-065 Action/Payment mock removal (mock dependency removal + payments status/detail endpoints-only + retry/error/stale-response evidence).
- v1.2.29 (2026-02-27, SCRUM-56): Add prompt_history evidence rule for BK-074 revenue API integration (summary/trend param sync, loading/error/empty, 400/401/403/5xx+network retry and previous snapshot restoration evidence).
- v1.2.28 (2026-02-26, SCRUM-57): Add prompt_history evidence rule for BK-075 settings API integration (company/geofences/members wiring, dirty/partial-save/schemaVersion, RBAC read-only, 400/403/409/5xx+retry, beforeunload guard).
- v1.2.27 (2026-02-26, SCRUM-50): Add prompt_history evidence rule for BK-064 payment status sync integration (canonical mapping/priority + reservations-home-action sync + 401/403/404/5xx fallback+retry evidence).
- v1.2.26 (2026-02-26, SCRUM-64): Add prompt_history evidence rule for BK-085 OCR flow integration (upload/sign + extract/job polling + partial/reupload/fallback/error branches).
- v1.2.25 (2026-02-26, SCRUM-45): Add prompt_history evidence rule for BK-054 reservations mock removal (mock import/fixture removal + v2 reservations single-source + no fallback evidence).
- v1.2.24 (2026-02-26, SCRUM-49): Add prompt_history evidence rule for BK-063 ActionRequired write integration (status/resolve/memo API, optimistic rollback, duplicate-submit guard, 400/403/409/5xx+network+Retry branches, filter drift handling).
- v1.2.23 (2026-02-26, SCRUM-44): Add prompt_history evidence rule for BK-053 reservations write integration (create/return/accident, submitting guard, success detail ID sync, 400/403/409/5xx handling).
- v1.2.22 (2026-02-26, SCRUM-43): Add prompt_history evidence rule for BK-052 reservations read integration (`page/size/status/from/to` sync, list/detail race-safe fetch, `from>to` validation, 400/401/403/404/5xx branches).
- v1.2.21 (2026-02-26, SCRUM-40): Add prompt_history evidence rule for BK-044 assets mock removal (mock import/flag removal + API single-source + no fallback evidence).
- v1.2.20 (2026-02-26, SCRUM-39): Add prompt_history evidence rule for BK-043 assets write integration (create/patch/history + dirty/saving + 400/403/409(form preservation)/5xx branches).
- v1.2.19 (2026-02-26, SCRUM-48): Add prompt_history evidence rule for ActionRequired query integration tickets (list query params/detail 404 fallback/filter race handling).
- v1.2.18 (2026-02-26, SCRUM-34): Add prompt_history evidence rule for login/protected-route tickets (returnUrl restore, login 401/429/network branches, single refresh-retry order).
- v1.2.17 (2026-02-26, SCRUM-38): Add prompt_history capture rule for BK-042 assets read integration evidence (`page/size/status/q` sync + 400/401/403/404/5xx handling).
- v1.2.17.1 (2026-02-26, SCRUM-35): Add prompt_history evidence rule for logout/session-expiry UX tickets (toast/modal/returnUrl/single-run 401 cleanup/storage cleanup).
- v1.2.16 (2026-02-26, SCRUM-31): Add prompt_history evidence rule for common loading/error/empty UI tickets (Retry + 401/403/5xx + skeleton/empty CTA checks).
- v1.2.15 (2026-02-26, NO-JIRA): Add rule to annotate BK items with mapped SCRUM IDs and Jira browse links when updating local parallel-group planning docs.
- v1.2.14 (2026-02-26, SCRUM-30): Add prompt_history capture rule for auth-context migration tickets (session key, token provider wiring, role mapping evidence).
- v1.2.13 (2026-02-26, NO-JIRA): Add canonical BE repo naming rule (`Project_Prometheus_BE`) and disallow legacy-prefixed BE repo path in docs metadata.
- v1.2.12 (2026-02-26, SCRUM-80): Add rule to keep FE API-contract docs as canonical references only when BE owns the OpenAPI source.
- v1.2.11 (2026-02-26, SCRUM-78): Add prompt_history capture rule to document success/failure branch evidence for save-flow bug fixes.
- v1.2.10 (2026-02-26, NO-JIRA): Add rule to record Jira snapshot date and new-ticket scope when updating local parallel-group planning docs.
- v1.2.9 (2026-02-26, SCRUM-31): Require Jira completion comments (key changes, notable points, PR link) immediately after `Resolved` transition.
- v1.2.8 (2026-02-25, SCRUM-32): Add Jira comment update requirement to End-of-Task checklist after PR creation.
- v1.2.7 (2026-02-25, SCRUM-29): Require AC-to-code evidence and build/test validation records in prompt_history for code-delivery tickets.
- v1.2.6 (2026-02-25, NO-JIRA): Add End Prompt finalization rules for post-PR worktree cleanup and Jira status transition to `Resolved`.
- v1.2.5 (2026-02-25, SCRUM-24): Add synchronization rule for Jira operating rules docs (`docs/jira_operating_rules.md` and `planning/06_jira_backlog_breakdown.md`).
- v1.2.4 (2026-02-25, SCRUM-23): Add rule to record OpenAPI/YAML validation results in prompt_history `Validation` for API contract tasks.
- v1.2.3 (2026-02-25, SCRUM-22): Clarify End Prompt documentation protocol with required prompt_history sections and ticket-linked capture rules.
- v1.2.2 (2026-02-25, NO-JIRA): Add NO-JIRA naming/PR fallback rules for non-ticket documentation runs.
- v1.2.1 (2026-02-25, BK-003): Update prompt_history naming convention to include Jira ticket ID for traceability.
- v1.2.0 (2026-02-25): Add Start Prompt capture rules and Push/PR automation convention (Korean PR to dev).
- v1.1.0 (2026-02-25): Add version policy table, prompt_history naming rules, end-of-task checklist, and commit message convention.
- v1.0.0 (2026-02-25): Initial baseline for prompt library + history workflow and branch policy alignment.

