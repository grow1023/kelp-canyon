#!/bin/bash
# Performance evidence for the current build on THIS machine. Usage: ./perf_report.sh <name>
#  A. GPU-bound frame cost: render the scripted flight in real time, wait for the GPU queue to drain after every frame.
#  B. CPU cost of one frame (JS + WebGPU command recording), no GPU wait.
#  C. ?bench mode with a trace: GPU timestamp queries, rAF frame-interval log, GC events on the main thread.
cd "$(dirname "$0")"; N=$1; uptime | sed 's/.*load/load/' > out/perf-$N-load.txt
./ab.sh set viewport 2560 1440 >/dev/null 2>&1; ./ab.sh open "http://127.0.0.1:8377/?cap" >/dev/null 2>&1; sleep 9
cat <<'JS' | ./ab.sh eval --stdin >/dev/null 2>&1
self.__pa=null;(async()=>{const N=1<<16,a=new Float32Array(N),tt=new Float32Array(N);let n=0;
 for(let k=0;k<60;k++){__r(-1,0);await __d.queue.onSubmittedWorkDone()}
 const s0=performance.now();
 for(;;){const now=performance.now(),t=(now-s0)/1e3;if(t>=60||n>=N)break;__r(-1,t);await __d.queue.onSubmittedWorkDone();a[n]=performance.now()-now;tt[n++]=t}
 const st=v=>{const s=v.slice().sort(),m=v.length,r=x=>+x.toFixed(2);let q=0,o=0;for(let i=0;i<m;i++){q+=v[i];if(v[i]>16.7)o++}return{frames:m,avg:r(q/m),p50:r(s[m>>1]),p99:r(s[Math.floor(m*.99)]),max:r(s[m-1]),over16_7:o}};
 const sec=[];for(let s=0;s<60;s++){let c=0,q=0,m=0;for(let i=0;i<n;i++)if(tt[i]>=s&&tt[i]<s+1){c++;q+=a[i];if(a[i]>m)m=a[i]}sec.push([+(q/c).toFixed(1),+m.toFixed(1)])}
 // B: CPU side only
 const c=new Float32Array(3000);for(let k=0;k<3000;k++){const t0=performance.now();__r(-1,k*.02);c[k]=performance.now()-t0}await __d.queue.onSubmittedWorkDone();
 self.__pa=JSON.stringify({resolution:innerWidth+'x'+innerHeight,gpuBound:st(a.slice(0,n)),perSecond:sec,cpuSubmit:st(c),visible:__v()})})();'started'
JS
for i in $(seq 1 40); do sleep 5; r=$(echo 'self.__pa' | ./ab.sh eval --stdin 2>/dev/null); case "$r" in *gpuBound*) break;; esac; done
python3 -c "import sys,json;json.dump(json.loads(json.loads(sys.argv[1])),open('out/perf-$N-a.json','w'))" "$r" || exit 1
# C
./ab.sh open "http://127.0.0.1:8377/?bench" >/dev/null 2>&1; sleep 1; ./ab.sh profiler start --categories "devtools.timeline,v8" >/dev/null 2>&1
for i in $(seq 1 45); do sleep 2; r=$(echo 'JSON.stringify(self.__bench||null)' | ./ab.sh eval --stdin 2>/dev/null); [ "$r" != '"null"' ] && [ -n "$r" ] && break; done
./ab.sh profiler stop "$PWD/out/perf-$N-trace.json" >/dev/null 2>&1
python3 -c "import sys,json;json.dump(json.loads(json.loads(sys.argv[1])),open('out/perf-$N-bench.json','w'))" "$r" || exit 1
uptime | sed 's/.*load/load/' >> out/perf-$N-load.txt
python3 - "$N" <<'PY'
import json,sys
N=sys.argv[1];a=json.load(open(f'out/perf-{N}-a.json'));b=json.load(open(f'out/perf-{N}-bench.json'))
t=json.load(open(f'out/perf-{N}-trace.json'));ev=t['traceEvents'] if isinstance(t,dict) else t
names={(e['pid'],e['tid']):e['args']['name'] for e in ev if e.get('ph')=='M' and e.get('name')=='thread_name'}
mk={e['args']['data']['message']:e['ts'] for e in ev if e.get('name')=='TimeStamp' and e.get('args',{}).get('data',{}).get('message') in('bench0','bench1')}
if len(mk)!=2:print('run marks missing in the trace:',mk);sys.exit(1)
gc=[e for e in ev if e.get('ph')=='X' and e.get('name') in('MinorGC','MajorGC') and names.get((e['pid'],e['tid']))=='CrRendererMain' and mk['bench0']<=e['ts']<=mk['bench1']]
d=lambda n:[e.get('dur',0)/1000 for e in gc if e['name']==n]
g={n:{'count':len(d(n)),'maxMs':round(max(d(n)),2) if d(n) else 0,'totalMs':round(sum(d(n)),2)} for n in('MinorGC','MajorGC')}
sec=a['perSecond'];empty=sum(1 for s in sec if s[0] is None);sec=[s for s in sec if s[0] is not None];quiet=[s for s in sec if s[1]<=16.7]  # a second with no frame at all means one frame took longer than a second
out={'load':open(f'out/perf-{N}-load.txt').read().split('\n')[:2],'resolution':a['resolution'],'adapter':b['adapter'],'gpuBound':a['gpuBound'],'secondsWithoutAnyFrame':empty,'secondsWithoutAFrameOver16_7':len(quiet),'gpuBoundInThoseSeconds':{'avgOfAvg':round(sum(s[0] for s in quiet)/max(len(quiet),1),2),'worstFrame':max([s[1] for s in quiet] or [0])},
 'cpuSubmit':a['cpuSubmit'],'drawsVisibleLastFrame':a['visible'],'bench':b,'gcInsideThe60sRun':g,'runSecondsInTrace':round((mk['bench1']-mk['bench0'])/1e6,1)}
json.dump(out,open(f'out/perf-{N}.json','w'),indent=1);print(json.dumps(out))
PY
