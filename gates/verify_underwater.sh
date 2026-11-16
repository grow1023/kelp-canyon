#!/bin/bash
# Master gate for the deterministic checks. Exit 0 only when every check passes (fail-closed).
# It does not judge visual quality (the critic does) and it does not measure the target PC.
cd "$(dirname "$0")/.." || exit 1; mkdir -p out; fail=0
chk(){ local n=$1; shift; if "$@" > "out/gate-$n.log" 2>&1; then echo "PASS[$n]"; else echo "FAIL[$n] see out/gate-$n.log"; fail=1; fi; }
chk gen          bun gates/gen_test.mjs                       # world invariants: buffers, NaN, winding, path + pose clearance, counts
chk build        bun build.mjs                                # one index.html, bundle really executes (no CommonJS wrapper)
chk single_file  bash -c '! grep -Eq "(src|href)=|https?://|import\(|fetch\(|XMLHttpRequest|<link|<img|url\(" index.html'
chk no_engine    bash -c '! grep -Eiq "three\.js|THREE\.|babylon|playcanvas|WebGLRenderer|getContext\(.webgl" index.html'
chk webgpu_only  bash -c 'grep -q "getContext(\"webgpu\")" index.html'
chk wgsl         bash -c './wgslcheck.sh | grep -q "WGSL OK"' # shader compiles in Chrome 157 with zero warnings or errors
chk page_runs    bash -c './ab.sh console --clear >/dev/null 2>&1; ./ab.sh open "http://127.0.0.1:8377/?cap" >/dev/null 2>&1; sleep 7; rm -rf cook/gate; ./cap.sh gate | grep -q 2560x1440 || exit 1
  [ "$(./ab.sh console 2>&1 | grep -c "\[error\]")" = 0 ] || exit 1; [ -z "$(./ab.sh errors 2>&1 | tr -d "[:space:]")" ] || exit 1
  for i in 1 2 3 4 5 6; do # every pose must be a real picture: mean luma and contrast inside sane limits
   ffmpeg -loglevel error -i cook/gate/p$i.png -vf "scale=320:-1,signalstats,metadata=print:file=-" -f null - | awk -F= "/YAVG/{a=\$2}/YMAX/{m=\$2}/YMIN/{n=\$2}END{if(!(a>40&&a<200&&m-n>80)){print \"pose $i luma \" a, n, m;exit 1}}" || exit 1; done'
chk heap         bash -c 'bun gates/heap.mjs "$(./ab.sh get cdp-url 2>/dev/null | tail -1)"'   # frame code allocates nothing beyond the WebGPU handle objects
chk controls     bash -c './ab.sh open "http://127.0.0.1:8377/?dbg" >/dev/null 2>&1; sleep 9; bun gates/controls.mjs "$(./ab.sh get cdp-url 2>/dev/null | tail -1)"'   # real key and mouse events, camera state read back
echo "bundle: $(wc -c < index.html | tr -d " ") bytes, gzip $(gzip -9c index.html | wc -c | tr -d " ") bytes"
[ $fail = 0 ] && echo "GATE PASS" || echo "GATE FAIL"; exit $fail
