#!/bin/bash
# GPU-bound frame cost + heap growth over the scripted 60 s fly-through, without vsync.
# Each frame: render at the real scripted time, then wait until the GPU has finished it. Usage: ./perf.sh <name>
D="$(dirname "$0")"; cd "$D"; ./ab.sh set viewport 2560 1440 >/dev/null 2>&1; ./ab.sh open "http://127.0.0.1:8377/?cap" >/dev/null 2>&1; sleep 6
./ab.sh profiler start --categories "devtools.timeline,v8" >/dev/null 2>&1
cat <<'JS' | ./ab.sh eval --stdin >/dev/null 2>&1
self.__perf=null;(async()=>{const N=1<<16,a=new Float32Array(N);let n=0;
 for(let k=0;k<30;k++){__r(-1,0);await __d.queue.onSubmittedWorkDone()}
 const s0=performance.now();let l=s0;
 for(;;){const now=performance.now(),t=(now-s0)/1e3;if(t>=60||n>=N)break;__r(-1,t);await __d.queue.onSubmittedWorkDone();const e=performance.now();a[n++]=e-now}
 const v=a.slice(0,n),sum=v.reduce((x,y)=>x+y,0);let over=0,worst=0,wi=0;for(let i=0;i<n;i++){if(v[i]>16.7)over++;if(v[i]>worst){worst=v[i];wi=i}}
 const s=v.slice().sort(),r=x=>+x.toFixed(2);
 // heap: render 3000 frames synchronously (no promises) and compare the JS heap before and after
 const h0=performance.memory.usedJSHeapSize;for(let k=0;k<3000;k++)__r(-1,k*.02);const h1=performance.memory.usedJSHeapSize;await __d.queue.onSubmittedWorkDone();
 self.__perf=JSON.stringify({resolution:innerWidth+'x'+innerHeight,frames:n,avg:r(sum/n),p50:r(s[n>>1]),p99:r(s[Math.floor(n*.99)]),max:r(worst),maxAtFrame:wi,over16_7:over,heapBytesPerFrame:Math.round((h1-h0)/3000),heap0:h0,heap1:h1})})();'started'
JS
for i in $(seq 1 30); do sleep 5; echo 'self.__perf' | ./ab.sh eval --stdin > out/perf-$1.raw 2>/dev/null; grep -q resolution out/perf-$1.raw && break; done
./ab.sh profiler stop "$PWD/out/trace-$1.json" >/dev/null 2>&1
python3 - "out/trace-$1.json" <<'PY'
import json,sys
t=json.load(open(sys.argv[1]));ev=t['traceEvents'] if isinstance(t,dict) else t
g=[e for e in ev if e.get('name') in('MinorGC','MajorGC') and e.get('ph') in('X','B')]
d=[e.get('dur',0)/1000 for e in g]
print('GC events in the 60 s run (+ heap check):',{'minor':sum(e['name']=='MinorGC' for e in g),'major':sum(e['name']=='MajorGC' for e in g),'maxPauseMs':round(max(d),2) if d else 0,'totalMs':round(sum(d),2)})
PY
python3 -c "import json;d=json.loads(json.loads(open('out/perf-$1.raw').read().strip().splitlines()[-1]));json.dump(d,open('out/perf-$1.json','w'),indent=1);print(d)"
