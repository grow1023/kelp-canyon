#!/bin/bash
# (Re)launch this project's headless Chrome 157 session with WebGPU on and frame throttling off.
# Usage: ./launch.sh [plain]   plain = default frame scheduling (no unthrottling flags)
A="--disable-dawn-features=timestamp_quantization,--enable-precise-memory-info"
[ "$1" = plain ] || A="$A,--disable-frame-rate-limit,--disable-gpu-vsync,--disable-background-timer-throttling,--disable-renderer-backgrounding,--disable-backgrounding-occluded-windows"
D="$(dirname "$0")"; cd "$D"; ./ab.sh close >/dev/null 2>&1; sleep 1
./ab.sh --webgpu --executable-path "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 --args "$A" \
 open "http://127.0.0.1:8377/?cap" 2>&1 | tail -1
./ab.sh set viewport 2560 1440 >/dev/null 2>&1; sleep 6
