#!/bin/bash
# GPU-bound cost per frame: render N scripted frames, wait for the GPU queue to drain after each. Usage: ./gpucost.sh W H
D="$(dirname "$0")"; cd "$D"; ./ab.sh set viewport $1 $2 >/dev/null 2>&1; ./ab.sh open "http://127.0.0.1:8377/?cap" >/dev/null 2>&1; sleep 6
cat <<'JS' | ./ab.sh eval --stdin 2>&1 | cut -c1-600
(async()=>{const a=[];for(let k=0;k<5;k++){__r(-1,1);await __d.queue.onSubmittedWorkDone()}
 for(let k=0;k<40;k++){const t=k*1.5,t0=performance.now();__r(-1,t);await __d.queue.onSubmittedWorkDone();a.push(performance.now()-t0)}
 const s=[...a].sort((x,y)=>x-y);return innerWidth+'x'+innerHeight+' ms/frame avg '+(a.reduce((x,y)=>x+y)/a.length).toFixed(1)+' med '+s[20].toFixed(1)+' max '+s[39].toFixed(1)+' @t='+(a.indexOf(s[39])*1.5)})()
JS
