# Rendering evidence

For changed October code, see [October validation](OCTOBER_VALIDATION.md). The measurements below describe the earlier release.

Measured on 4 October 2026 UTC (5 October in Canberra), against the local production client build and isolated server on port 8096. These are short headless browser measurements, not physical display latency, physical phone, eight-player worst-case, or deployed-service certification.

## Result and change

The low initial browser FPS came from Linux Chromium's SwiftShader software graphics backend. JavaScript scene construction and render submission generally took about 1–2 ms combined; filling a large antialiased canvas dominated the software path.

The client now identifies software WebGL backends (SwiftShader, llvmpipe, softpipe, or a renderer identifying itself as software) before initializing Pixi. Only those backends disable MSAA and use a backing-store pixel budget of 1280 × 720, capped at one backing pixel per CSS pixel. The budget updates on resize. Hardware rendering keeps antialiasing and device-pixel ratio up to 2. No gameplay detail, objects, or effects are removed. Menus, HUD, and touch buttons remain HTML at full display resolution.

The automatic final configuration measured **51.5 FPS on software-rendered desktop and 60.0 FPS on the software-rendered phone viewport**. On the actual Intel Arc hardware path, it preserved antialiasing and measured **60.1 FPS desktop** and **60.2 FPS in the phone-sized viewport**.

## Method

`scripts/browser-performance.ts` launches separate fresh browser contexts, opens Practice (Outpost Yard with two active bots), waits one second, and measures for approximately four seconds. It ends and saves each match before closing that context. All measured documents reported `visibilityState = visible` throughout. Single-page cases bring the page to the foreground. Two-context cases keep both render loops active and record both concurrently.

With the explicit `renderProbe=1` URL option, `src/client/render.ts` records actual Pixi `postrender` submission counts and intervals, alongside independent requestAnimationFrame counts. It also records scene-construction CPU time, render-submission CPU time, actual WebGL antialias state, renderer/vendor strings, canvas dimensions, and resolution. These counters measure frames submitted by the renderer, not GPU completion fences or display scanout. Instrumentation and override parameters are absent from normal play unless the probe option is explicitly supplied.

The native Windows run used an isolated hidden headless Chrome profile under the authorized visualization directory, controlled through its own local CDP port. It did not use the user's personal browser profile. No other browser acceptance runs were active during comparisons. Root's server-only soak tests had low CPU cost; they finished before the final automatic comparisons.

## Environments

| Item | Software browser | Native hardware browser |
| --- | --- | --- |
| Browser | Headless Chromium 153.0.8010.12 | Headless Chrome 154.0.8037.97 |
| OS | Linux WSL2 | Windows 10.0.26200 |
| CPU | Intel Core Ultra 9 285H; 8 WSL logical CPUs | Intel Core Ultra 9 285H; 16 logical CPUs |
| Memory available | 20 GiB WSL | 31 GiB Windows |
| WebGL renderer | ANGLE Vulkan 1.3.0, SwiftShader Device (Subzero) | ANGLE Intel Arc 140T GPU (16GB), Direct3D11 |
| Desktop viewport | 1920 × 1080; DPR 1 | 1920 × 1080; DPR 1 |
| Phone viewport | 390 × 844; DPR 2; touch emulation | 390 × 844; DPR 2; touch emulation |

The phone viewport on Windows still uses the desktop Intel GPU. It is not a physical phone measurement. An NVIDIA GPU is also installed, but the browser explicitly reported Intel Arc; no NVIDIA result is claimed.

## Controlled comparisons

FPS below counts actual Pixi render submissions, rounded to one decimal. Small values above 60 result from finite sample boundaries.

| Case | Software FPS | Native Intel FPS |
| --- | ---: | ---: |
| Home page, desktop (rAF only; no game renderer) | 60.0 | 59.9 |
| Home page, phone viewport (rAF only) | 60.0 | 60.2 |
| Desktop, AA on, resolution 1 (1920 × 1080 canvas) | 17.3 | 59.9 |
| Desktop, AA off, resolution 1 | 28.6 | 60.1 |
| Desktop, AA off, resolution 0.75 (1440 × 810) | 40.6 | — |
| Desktop, AA off, resolution 2/3 (1280 × 720) | 48.9 | — |
| Phone, AA on, resolution 2 (780 × 1688) | 22.6 | 60.2 |
| Phone, AA off, resolution 2 | 35.2 | — |
| Phone, AA off, resolution 1 (390 × 844) | 59.7 | 60.0 |
| **Final automatic desktop** | **51.5** | **60.1** |
| **Final automatic phone viewport** | **60.0** | **60.2** |

| Two simultaneously active contexts | Software desktop FPS | Software phone FPS |
| --- | ---: | ---: |
| Original: AA on; desktop resolution 1 / phone resolution 2 | 10.7 | 10.7 |
| AA off; both resolution 1 | 24.8 | 26.7 |
| **Final automatic fallback** | **49.6** | **50.1** |

Final single-page postrender interval p95: software desktop 23.3 ms, software phone 17.8 ms; native desktop 17.7 ms, native phone viewport 19.0 ms. Final two-context software p95: desktop 26.1 ms, phone 28.2 ms.

Visual review covered native full-resolution desktop, software 720p-budget desktop, and software resolution-1 phone screenshots. Player/equipment silhouettes and HUD labels remain readable. Lower-resolution software canvas text is visibly softer; full-resolution HTML HUD remains crisp. Touch camera framing keeps the local pilot above the action controls.

## Reproduce

Run a fresh local server with the production client build, then:

```sh
APP_URL=http://localhost:8096 node scripts/browser-performance.ts
PERF_CASES=desktop-auto,phone-auto PERF_SKIP_DUAL=1 PERF_LABEL=software-auto node scripts/browser-performance.ts
PERF_CASES=none PERF_DUAL_MODES=auto PERF_LABEL=software-auto-dual node scripts/browser-performance.ts
```

Use the project's Node runtime (`mise exec -- node`) rather than a TypeScript transpiler that injects helpers into Playwright's serialized browser functions.

For an already-running isolated native browser, set `PERF_CDP` to its local debugger endpoint. `PLAYWRIGHT_MODULE` optionally accepts a direct Playwright module URL when the native runtime cannot resolve the WSL package symlink. `PERF_SAMPLE_MS` changes the sample duration, `PERF_CASES` selects comma-separated cases, and `PERF_LABEL` gives the output a distinct filename.

Local generated evidence (ignored by Git):
- `test-results/browser-performance.json`: initial complete software comparison.
- `test-results/browser-performance-software-budget.json`: 0.75 and 2/3 resolution trials.
- `test-results/browser-performance-software-auto.json`: final automatic software selection.
- `test-results/browser-performance-software-auto-dual.json`: final two-context comparison.
- `test-results/browser-performance-windows-gpu.json`: native explicit AA/resolution comparisons.
- `test-results/browser-performance-windows-auto.json`: final automatic native selection.
- `test-results/performance-*.png`: screenshots from measured runs.

No browser page errors were recorded in completed comparisons. One attempted run used a transpiler that injected an unavailable helper into page evaluation; it was rerun with Node's native TypeScript support. Its abandoned training match briefly occupied the server's one-live-match cap; the next comparison waited for that match to close before rerunning. Neither failed attempt is used as performance evidence.


## 10 October illustrated-arena revision: software compositing

The richer illustrated terrain and backgrounds kept the native Intel Arc hardware path near 60 FPS in the integrator's 10-second samples, but increased software raster cost. The final correction is limited to positively identified software WebGL backends: static terrain/scenery/objective labels are rasterized once, and the complete illustrated background is flattened into one opaque cached image. Dynamic players, projectiles, pickups, flags, gas and combat effects remain separate live layers. Hardware retains vector rendering and independent background parallax.

Three sequential 10-second foreground samples used Chromium 153.0.8010.12 / WSL SwiftShader, the local production build on port 8081, Practice with two active bots, and actual Pixi postrender counts:

| Configuration | Desktop 1920 × 1080 viewport, 1280 × 720 canvas | Phone 390 × 844 viewport/canvas |
| --- | ---: | ---: |
| Same final build, caches disabled with probe override | 26.8 FPS | Not repeated |
| First trial: static world and separate background caches | 34.4 FPS | 60.0 FPS |
| **Selected: static world plus one opaque background cache** | **42.6 FPS** | **60.0 FPS** |

The selected configuration improves the same-build software desktop result by approximately 59%; p95 frame interval falls from 41.6 ms to 26.5 ms. Scene construction/submission remain about 0.3/0.9 ms, consistent with software graphics composition being the limiting cost. Canvas resolution was not lowered further. The software desktop path remains below 60 FPS; no physical phone or display-latency claim follows from these headless samples.

Tradeoff: software rendering moves the background illustration as a single parallax layer, so it loses relative movement between its distant layers. Every illustrated layer remains visible. Static world caching also uses additional client-side texture memory and may slightly soften world artwork when magnified; the HTML HUD stays at full display resolution. Caches rebuild on map/viewport changes. Full hardware artwork and separate parallax remain enabled.

Desktop and phone screenshots from the selected run were visually inspected: terrain, scenery, character silhouettes, equipment, pickups and HUD remained correct and readable, with the local phone pilot clear of touch buttons. No browser page errors occurred. The same-build override is available only with the explicit render probe: `PERF_RENDER_CACHE=0` sets `renderCache=0`; normal play uses automatic software detection.

Local reports:
- `test-results/browser-performance-revision-software-cache-off.json`
- `test-results/browser-performance-revision-software-cache.json`
- `test-results/browser-performance-revision-software-flat-cache.json`
- `test-results/performance-{desktop,phone}-auto-revision-software-flat-cache.png`

Run through the project's Node runtime with `APP_URL=http://localhost:8081 PERF_SAMPLE_MS=10000 PERF_CASES=desktop-auto,phone-auto PERF_SKIP_DUAL=1`. Set a distinct `PERF_LABEL` for each report. No other browser acceptance run was active during these comparisons; server-only load checks had completed before the final pair.
