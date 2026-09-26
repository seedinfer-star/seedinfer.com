# MapLibre v6 (6.11.2) migration — TODO, DO NOT APPLY YET

Current: `maplibre-gl` 4.7.1 pinned (`package.json:19`), types via
`@types/maplibre-gl` (`package.json:32`). Stay on v4 until this checklist is done.

## What breaks

1. **ESM-only import** — `components/map/MapCore.tsx:3`
   `import maplibregl from "maplibre-gl"` stays syntactically valid, but v5+
   ships ESM-only. Verify Next 15.5 bundles it without `transpilePackages`;
   if the build complains, add `"maplibre-gl"` to `transpilePackages` in
   `next.config.mjs` (keep `optimizePackageImports`, do not remove it).
2. **Worker copy** — v5+ requires the CSP worker to be served locally.
   Copy `node_modules/maplibre-gl/dist/maplibre-gl-csp-worker.js` to
   `public/maplibre/maplibre-gl-csp-worker.js` and set it before constructing
   the map in `components/map/MapCore.tsx` (~line 87, `new maplibregl.Map`):
   ```ts
   // @ts-expect-error — workerClass is set at runtime
   maplibregl.workerClass = await import("maplibre-gl/dist/maplibre-gl-csp-worker").then(m => m.default)
   ```
   or the `workerUrl` equivalent. Without this the map silently fails to load
   tiles on strict-CSP browsers.
3. **Bundled types — drop `@types/maplibre-gl`** — v6 ships its own `.d.ts`.
   Remove the `@types/maplibre-gl` devDependency (`package.json:32`) and
   re-check `components/map/map-style.ts:1`
   (`import type maplibregl from "maplibre-gl"`) plus
   `components/map/MapCore.tsx` type usages
   (`maplibregl.Map`, `maplibregl.GeoJSONSource`) with `npx tsc --noEmit`.
4. **WebGL2 required** — v6 drops WebGL1. The constructor `try/catch` in
   `components/map/MapCore.tsx:87-99` already routes failures to
   `components/map/MapEmpty.tsx`, so graceful degradation is in place; re-test
   on a WebGL1-only device/browser after the bump. `MapLazy.tsx` zero-location
   fallback is unaffected.
5. **CSS path** — `app/layout.tsx:1`
   (`import "maplibre-gl/dist/maplibre-gl.css"`) must stay; confirm the path
   still exists in 6.11.2 before deleting the lockfile entry.

## Checklist

- [ ] `npm install -E maplibre-gl@6.11.2` on a scratch branch
- [ ] Remove `@types/maplibre-gl` from devDependencies
- [ ] Copy CSP worker to `public/maplibre/` + wire `workerClass`
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm test` passes
- [ ] Throwaway build green:
      `DATABASE_URL=file:/tmp/seedinfer-build-throwaway.db DB_BACKUPS=off npm run build`
- [ ] Manual check: dark/light theme switch, zero locations, WebGL-disabled browser

Do NOT enable globe/terrain (Pi RAM/CPU budget).
