# 경기도 렌터카 영업 지도

Super admin menu: **렌터카 영업 지도** → `/admin/rental-prospects`.

- Leaflet 1.9.4 with OpenStreetMap raster tiles, visible attribution, browser caching. `VITE_OSM_TILE_URL` optionally overrides the tile endpoint; default `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Any replacement must retain correct provider attribution. No bulk tile download or prefetch.
- Drag, mouse wheel, keyboard and +/- controls support pan/zoom. Radius grows with square root of source total vehicles and is bounded 5–42 pixels. Null totals use 5 pixels. Blue = marketing target; grey = excluded.
- Hover shows name, office type, address, telephone, total and vehicle categories, source date and marketing status. Tooltip uses text nodes to prevent source HTML execution. Click a point or list entry for full details and editable notes.
- Side list reflects the current map bounds AND search/exclusion filters. Coordinates missing/invalid: separate expandable list with details and note editing, no invented map point.
- Default filter: marketing targets only. Other options: all / excluded only. Name, address and phone search is client-side.
- Memo Save persists explicitly to the API. Drafts are retained across office selection; dirty indicator, browser unload warning and route navigation dialog protect unsaved drafts. Failed saves retain text for retry. Exclusion saves immediately; map changes only after server confirmation.
- Memo and exclusion updates are independent partial writes; toggling exclusion does not overwrite an unsaved memo.
- Actual local UI verified using 408 public Gyeonggi offices. Production build passes; browser regression covers hover, radius, selection, memo reload, exclusion, search, zoom/pan viewport list and non-super-role redirects. Mock browser tests are separate from live HTTP/Mongo verification.

Source: https://www.data.go.kr/data/15025689/standard.do. Published data may have missing/placeholder values and varies by source date; not a guaranteed census. Current snapshot is versioned in backend; refresh procedure is in backend `docs/features/rental-prospects.md`.

Screenshot: [live local public-data map](../screenshots/rental-prospects.png).
