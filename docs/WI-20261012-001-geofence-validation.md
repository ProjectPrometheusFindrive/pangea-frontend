# Geofence live validation UI support

The circle editor previously required clicks on a nationwide map and offered no coordinate or exact radius entry. Add labelled latitude, longitude and radius inputs connected to the existing map form and backend validation so an observed vehicle position can be entered accurately. Polygon behavior is unchanged.

Explain observation-based dwell, reset after excessive observation gaps, and that active fences are risk zones (normal parking can intentionally trigger a test).

Manual production acceptance: test-company scope, a 100 m circle around the current sample position, five-minute dwell and forty-five-minute observation gap, then wait for real collector observations and inspect the resulting theft action card. No simulated production location records are used.
