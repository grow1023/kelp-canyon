# Kelp Canyon: run ledger

Target: real-time fantasy underwater scene, WebGPU, no engine, one self-contained `index.html`.
Acceptance (from the request): critic reports nothing above MINOR. GPU frame time average 11 ms or less and no frame above 16.7 ms on the target PC during the scripted 60 s fly-through.
Caps: 8 critic rounds at most. No final long render is needed (the deliverable is the page).
Capture: headless Chrome 157 (Apple M4 Pro, Metal), 2560x1440, `cap.sh` (6 poses), `rec.sh` (fly-through), `perf.sh`.
Critic: fresh subagent each round. It receives only the folder with renders.

| Round | What changed | Evidence | Result |
|---|---|---|---|
| r01 | First render | cook/r01/sheet.jpg | Own check: kelp fronds far too large, they block every pose |
| r02 | Kelp rebuilt (230 small fronds), ship v2, fog, surface refraction, rock strata | cook/r02/sheet.jpg | Own check: ship unreadable, fluke faces away |
| r03 | Ship basin widened, path circles the ship, colours | cook/r03/sheet.jpg | Own check: manta is a blob, pose 5 looks at a slab |
| r04 | Manta v2 (swept wing), ship scale, shadow map 4096, 32 ray steps | cook/r04/sheet.jpg | Own check: ship has no masts |
| r05 | Ship masts, yards, quarterdeck. Poses lifted above the floor (gate added) | cook/r05/sheet.jpg | Pose 5 was under the floor, fixed |
| r06 | Pose 5 broadside view, fly-through recording | cook/r06/ | Critic round 1 |

## Measurements between rounds
- CORRECTION: the first controls check (out/ctl/sheet.jpg) was wrong. The test tool sent key events without `code`, so W and Q did nothing; only pointer lock and mouse look were really shown. I misread kelp sway as camera motion.
  Replaced by `gates/controls.mjs` (real CDP key and mouse events, camera coordinates read back, out/controls.json): W/S/A/D/Q/E directions, Shift 3.6x, key without `code` (fallback), pointer lock, hint hide and return, mouse yaw and pitch, pitch clamp. Exit 0.
- JS heap allocation, CDP allocation sampling over 3000 frames after JIT warm-up (gates/heap.mjs, out/heap.json):
  scripted flight 203 B/frame, free flight 204 B/frame, idle 197 B/frame. All of it is attributed to `render()`: the WebGPU handle objects that the API creates each frame
  (1 command encoder, 7 pass encoders, 1 command buffer, 1 canvas texture and its view). The scene code itself allocates 0 B/frame.
  Before the fix the frame code allocated about 550 B/frame: doubles in closure variables, `Math.hypot`, and double arguments to functions that the JIT did not inline.
- Own check after r06 (cook/gate/sheet.jpg): the distance was teal, not deep blue. Cause: the god-ray term added a flat teal haze that hid the fog colour.
  Fix: bluer in-scatter colour, shafts without the constant haze term, shaft tint follows the view direction. The distance is now deep blue.
- Master gate `gates/verify_underwater.sh`: 8 checks, exit 0 (gen, build, single_file, no_engine, webgpu_only, wgsl, page_runs, heap).

## Critic round 1 (on r06): HIGHEST SEVERITY MAJOR. CRITICAL=0 MAJOR=4 MODERATE=6 MINOR=6
| # | Severity | Defect | Fix (r07 to r09) |
|---|---|---|---|
| 1 | MAJOR | Rock does not read as rock; walls look like tilted water | Cell-based ledges and joints in the rock shader, terraces in the terrain SDF, caustics removed from steep faces, bushes and corals on the walls |
| 2 | MAJOR | One teal hue; distance never deep blue | Bluer in-scatter, constant haze removed from the shaft term, shaft tint follows the view direction |
| 3 | MAJOR | Fluke sculpture flat, merges with the wall | Fluted stem, three carved rings, fan grooves, chips, warm limestone albedo, growth on top |
| 4 | MAJOR | Fish toy-like when close | Dorsal, anal and pectoral fins, forked tail, eye, flank band; schools stay 5.5 m or more from the scripted camera |
| 5 | MODERATE | God rays switch off abruptly | Near samples weighted by distance. Luma steps of 2.5 or more in one frame: 47 before, 2 after (both are a kelp column that crosses the frame) |
| 6 | MODERATE | Sparkle specks flash into plaid squares | `pow()` of a base that can round below zero removed, bloom source clamped |
| 7 | MODERATE | Fish pass through the camera and each other | Swimmers shrink to zero near the camera; each fish owns one slot of a 12x5x4 lattice |
| 8 | MODERATE | Mantas flat and unshaded | Belly with grey margins and gill slits, shoulder bars on the back, view-dependent shading |
| 9 | MODERATE | Look-up pose washed out | Snell window: blue sky gradient, refracted sun, stronger waves |
| 10 | MODERATE | Ground cover is a flat fill | 48,000 tufts (12 blades each), dark soil under them, tint and brightness vary per tuft |
| 11 | MINOR | Bubbles vanish in one frame | Fade over 0.8 to 5 m |
| 12 | MINOR | Sponge inside the hull | Floor props are rejected inside the ship and sculpture SDF |
| 13 | MINOR | Near-white leaf | Leaf specular reduced |
| 14 | MINOR | Straight cliff rim | Plateau height varies |
| 15 | MINOR | Boulders smooth | Seven random plane cuts per boulder, moss tufts and plants on top |
| 16 | MINOR | Ship polish | Coralline crust, plants on the deck, broken hatch edge |

Performance note: this Mac had a load average near 13.8 from other work (Swift build, WindowServer, other sessions). Frame cost in undisturbed seconds: 7.6 to 8.9 ms average, 9 to 10 ms maximum.

## After r09 (in the r10 build, critic round 2 runs on r09)
- Far-water backdrop pass: pixels with no geometry (past the terrain edge, past the 650 m surface plane) showed the flat clear colour. A fullscreen triangle at the far plane now fills them with the fog in-scatter colour. Evidence: cook/r10/edge_s.jpg (view outward from the world boundary: no visible edge).
- Camera collision now includes the ship, the sculpture and the boulders (stamped into the density grid). Evidence: the camera driven at the hull stops at (63.3, -37.8, -24.0) and stays there. Gate checks added in gates/gen_test.mjs.
- `?bench` runs to the end and shows the result (out/bench-r10.json). The numbers from this run are NOT usable: headless Chrome does not pace frames at a display rate, and the machine load average was 13.8.

## Critic round 2 (on r09): HIGHEST SEVERITY MAJOR. CRITICAL=0 MAJOR=1 MODERATE=9 MINOR=8. No rendering bug, popping, flicker or banding found.
| # | Severity | Defect | Fix (r10, r11) |
|---|---|---|---|
| 1 | MAJOR | Ruler-straight rock wall behind the ship | Rim height now varies by 22 m and more, passes cut through the rock, the ship basin has an uneven edge, buttresses on the walls |
| 2 | MODERATE | Shadowed ship side is a dark slab | Ambient with sand bounce (x2.2 on the ship), AO floor, less red absorption in sunlight |
| 3 | MODERATE | One rock material everywhere | Canyon rock is bedded strata, boulders have chunky facets, close range adds small fractures |
| 4 | MODERATE | Ground cover is hard shards with intersections | Round-tipped fronds with curved shading normals, soft light; occupancy grid keeps props, rosettes and cover apart; patches thin out at the edge |
| 5 | MODERATE | Ship built from obvious primitives | Ribs stand above the rail, planks break off one by one, tapered masts with splintered ends, top platform, sternpost; mesh resolution 0.25 |
| 6 | MODERATE | Aliased plank seam lines | Seam width follows the pixel footprint and fades out before it can alias |
| 7 | MODERATE | Water surface is a flat two-tone pattern | Soft Snell window edge, sun glow and glints; pose 2 now looks toward the sun |
| 8 | MODERATE | Set pieces do not separate from rock | Limestone sculpture turned to face the sun, warmer wood, sunlight keeps red at depth |
| 9 | MODERATE | Arch underside smooth and blurry | Extra fracture octave on the arch SDF, close-range cell fractures in the shader |
| 10 | MODERATE | Sponges read as glazed pots | Matte, porous, mottled surface; lumpy shape with an uneven rim; no specular, no rim light |
| 11-18 | MINOR | Dither grain, manta tail, uniform school, low-poly coral, bubble sprites, fluke material by side, pale plates, kelp near the path | Manta tail bends (5 segments), kelp 5.5 m from the path, smaller bubbles that fade earlier, fluke cracks toned down. Others left as they are (minor). |

## Critic round 3 (on r11): HIGHEST SEVERITY MAJOR. CRITICAL=0 MAJOR=1 MODERATE=4 MINOR=8. No banding, flicker, popping or near-plane clipping found.
| # | Severity | Defect | Fix (r14) |
|---|---|---|---|
| 1 | MAJOR | Water surface breaks into a checkerboard at 55 to 56.6 s | Cause: lattice of the value noise in the wave field, shown as tiles by the total-reflection threshold. The wave field is now 8 rotated sines with a domain warp; each wave fades with its pixel footprint. Evidence: cook/r13/surf_before_crop.jpg, cook/r14/surf_after_crop.jpg |
| 2 | MODERATE | Hard white rectangles on the mantas' backs | Soft Gaussian shoulder marks, darker wing tips |
| 3 | MODERATE | Floating boulder has patchwork shading | Facet patches removed; boulders use the same bedded strata as the cliffs |
| 4 | MODERATE | Ground-cover blades have chopped tips | Fronds end in a point |
| 5 | MODERATE | Flat spotted pattern under the ground cover | Soft plum soil without hard blobs, wider blend into the sand |
| 9, 10, 13 | MINOR | Sponges near-black, small bubble rings break up, sun bloom too wide | Brighter sponge palette, small bubbles drawn as soft discs, weaker sun glow |
| others | MINOR | Uniform strata, painted fluke grooves, plain hull side, kelp leaf corners, stair-stepped shadow edge | Left as they are |

## Other changes since r11
- Frustum culling: 417 chunks (world triangles and instances sorted into 40 m cells; one chunk per school and per manta). Poses match the unculled render (PSNR 55 to 74 dB; the remaining difference is the one-frame lag of the god-ray depth, which exists without culling too).
- Timestamp queries are created only in `?bench` mode.
- Key input falls back to `event.key` when `event.code` is empty.
- New evidence for the critic: `pan_start.mp4` (360 degree turn at the start position) and `surface0..3.png`.

## Critic round 4 (on r14): HIGHEST SEVERITY MODERATE. CRITICAL=0 MAJOR=0 MODERATE=1 MINOR=10. All brief items PRESENT. No popping, flicker, banding or fixed noise.
| # | Severity | Defect | Fix (r15) |
|---|---|---|---|
| 1 | MODERATE | Water surface ripples form a regular lattice | Cause: wave directions stepped by a fixed angle near 126 degrees, so three directions repeated. Now 10 waves with golden-angle directions plus jitter, uneven frequency ratios, wave groups, sharpened crests and two slow warps. Evidence: cook/r15/water.jpg. Fixed camera, frames 1/60 s apart: mean change 0.63 levels, steady. |
| 3 | MINOR | Free-standing stack of boards at the stern | Sternpost moved to the hull end |
| 6 | MINOR | Sculpture grooves read as painted stripes | Lit rim beside each groove, weaker patina stains |
| 7 | MINOR | Kelp tops nearly level | Height range 13 to 38 m |
| others | MINOR | Hull side plain, arch flat, pale patches, fish headings, edge steps, cover slivers, faint streaks | Left as they are |

## Run stopped by the user after critic round 4
- Critic round 5 (on r15) was started and then cancelled at the user's request. It returned no result.
- Last completed review: round 4, HIGHEST SEVERITY MODERATE (1 MODERATE, 10 MINOR). The fix for that MODERATE defect (water surface lattice) is in r15 and is NOT verified by a critic.
- Visual gate (nothing above MINOR): not passed by the stated criterion. Performance gate: not measured on the target PC.
- Final index.html: 52,430 bytes (gzip 23,596), sha256 92c9533c39715bc6. Master gate: 9 checks, exit 0.

## Deployed 2026-11-16
- Vercel project `voidlight/kelp-canyon`, production. Public alias https://kelp-canyon.vercel.app
  - `/` the scene (index.html, unchanged apart from one link), `/making-of` the build record.
  - The deployment-specific URL (kelp-canyon-mi5xsiw3n-voidlight.vercel.app) is behind Vercel Authentication; the alias is public.
- Checked: both paths HTTP 200, served bytes identical to the local files, the scene renders over https in headless Chrome (mean luma 96.8), the in-page link moves to /making-of, console errors 0.
- Build record page: 12 phases, 28 terms with tooltips (mouse, keyboard focus, click; Escape closes), glossary of the same 28 terms, light and dark themes with sun/moon buttons, no horizontal page scroll at 390px.

## V2: rebuild from the improved prompt (2026-11-16)
The user asked for a before/after comparison on the Vercel site. V1 (the build above) is kept unchanged in `v1/` (index.html sha256 92c9533c39715bc6).
Improved prompt = original prompt + QUALITY BAR, TECHNIQUE HINTS, PRODUCT SHELL, PROCESS (full text in `docs/compare.html`).
Target: density floor (1,000,000 leaves, 10,000 rocks, 2,000 fish), bundle under 150 KB, GPU terrain, LOD and distance culling, dynamic resolution, menu, detail levels, touch, audio.
Caps: 3 critic rounds. Reference analysis of Noniv/abyssal-garden: not used (user choice). No reference screenshots were supplied.

| Round | Change | Evidence | Result |
|---|---|---|---|
| v2a | Detail levels, GPU terrain (compute shader, checked against the CPU formula at 500 points), staged build + loading bar, kelp x4, rocks, kelp and tuft LOD, per-group draw distance, dynamic resolution ladder (8 steps), menu, touch, audio | cook/v2a/sheet.jpg | Gate FAIL once: timestamp resolve offset must be a multiple of 256 (fixed with a 16-byte resolve buffer). Then 9 PASS |
| v2r1 | Evidence for critic round 1 | cook/v2r1/ | Critic: MAJOR 1 / MODERATE 4 / MINOR 4. Kelp hid the start area and the landmarks |
| v2b, v2r2 | Kelp-free cone in front of each pose, start clearing, sight lines to ship and sculpture, three height classes, far specks fade | cook/v2r2/ | Critic: MAJOR 0 / MODERATE 5 / MINOR 6. No pops (0 against 20 in V1). Kelp now too thin in open water |
| v2c, v2r3 | Narrower cone (34 m, 5 m + 13%), 8.5 m start clearing, 3.2 m sight lines | cook/v2r3/ | Critic round 3: see below |

Measured (M4 Pro, 2560x1440, GPU-wait method, machine under load from other sessions, load average 5 to 24):
- V1 p50 7.8 to 10.4 ms over four runs. V2 p50 8.7 to 12.5 ms over four runs. Runs alternate V1, V2.
- GPU terrain: 82 to 167 ms, 0 of 500 points differ from the CPU formula. Whole load: 1.9 to 5.4 s (depends on machine load).
- Audio (90 s offline render): -21.8 LUFS, peak -6.7 dBFS, 0 clipped samples. Measured with earshot. Not judged by ear.
- Timestamp-query numbers of the V1 build were not credible on this machine (0.39 ms average). They are not used.
Not verified: target PC (RTX 5070 Ti), touch steering on a real phone, Low and Medium levels in a real browser session (only High was captured).

## V2 critic round 3 (on v2r3, blind A/B against V1 r15): OVERALL "V2 better". MAJOR 0 / MODERATE 4 / MINOR 5
V2 wins p3, p4, p5, p6, surface and the fly-through. V1 wins p2 slightly. p1 equal. No pops, flicker, banding or boundary.
V2 worse than V1: kelp stalk in front of the ship bow at 39.0 to 40.8 s, start view more cluttered, mantas bunched in the look-up pose.
Stopped at the cap of 3 rounds. Visual gate (nothing above MINOR): NOT passed.
