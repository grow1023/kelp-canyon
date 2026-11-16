# Kelp Canyon

A procedural WebGPU underwater scene in one `index.html`. No engine, no texture or model files.

Live: https://kelp-canyon.vercel.app (prompt comparison), `/v1`, `/v2`, `/making-of`

- `index.html`: V2 build (67 KB). `v1/`: the first build (52 KB).
- `src/`, `build.mjs`: source and bundler (`bun build.mjs`).
- `gates/verify_underwater.sh`: master check. It needs a headless Chrome session.
- `deploy/`: the published site. `docs/`: comparison and making-of pages.
- `cook/ROUNDS.md`: record of each render and critic round. The capture files are not in this repository.

The original build prompt comes from https://github.com/Noniv/abyssal-garden (MIT). This repository contains none of its code.

Not verified: RTX 5070 Ti performance, touch on a real phone, sound by ear.
