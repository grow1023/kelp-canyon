#!/bin/bash
# Build, then compile the WGSL in the live Chrome session and print only the errors with a short excerpt.
D="$(dirname "$0")"; cd "$D"; bun build.mjs || exit 1
{ printf '(async()=>{const W='; python3 -c "import json;print(json.dumps(open('out/all.wgsl').read()))"; cat <<'JS'
;const ad=await navigator.gpu.requestAdapter(),dev=await ad.requestDevice(),m=dev.createShaderModule({code:W}),i=await m.getCompilationInfo();
 const e=i.messages.filter(m=>m.type!='info').map(m=>m.type+' @'+m.linePos+': '+m.message+' >>> '+W.slice(Math.max(0,m.linePos-70),m.linePos+50));
 return e.length?e.slice(0,6).join('\n'):'WGSL OK'})()
JS
} | ./ab.sh eval --stdin 2>&1 | python3 -c "import sys,json;t=sys.stdin.read().strip();print(json.loads(t) if t.startswith('\"') else t[:1500])"
