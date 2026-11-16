#!/bin/bash
# Per-second series of the GPU-bound frame cost over the scripted flight: "avg/max" in ms for each second.
cd "$(dirname "$0")"; cat <<'JS' | ./ab.sh eval --stdin >/dev/null 2>&1
self.__ts=null;(async()=>{const N=1<<16,a=new Float32Array(N),tt=new Float32Array(N);let n=0;
 for(let k=0;k<30;k++){__r(-1,0);await __d.queue.onSubmittedWorkDone()}
 const s0=performance.now();
 for(;;){const now=performance.now(),t=(now-s0)/1e3;if(t>=60||n>=N)break;__r(-1,t);await __d.queue.onSubmittedWorkDone();a[n]=performance.now()-now;tt[n++]=t}
 const sec=[];let over=0,sum=0,mx=0;for(let i=0;i<n;i++){sum+=a[i];if(a[i]>16.7)over++;if(a[i]>mx)mx=a[i]}
 for(let s=0;s<60;s++){let c=0,q=0,m=0;for(let i=0;i<n;i++)if(tt[i]>=s&&tt[i]<s+1){c++;q+=a[i];if(a[i]>m)m=a[i]}sec.push((q/c).toFixed(1)+'/'+m.toFixed(0))}
 const v=a.slice(0,n).sort();self.__ts=JSON.stringify({n,avg:+(sum/n).toFixed(2),p50:+v[n>>1].toFixed(2),p99:+v[Math.floor(n*.99)].toFixed(2),max:+mx.toFixed(1),over,sec})})();'started'
JS
for i in $(seq 1 30); do sleep 5; r=$(echo 'self.__ts' | ./ab.sh eval --stdin 2>/dev/null); case "$r" in *sec*) break;; esac; done; echo "$r" | python3 -c "
import sys,json;d=json.loads(json.loads(sys.stdin.read()));s=d.pop('sec');print(d)
for i in range(0,60,10):print(f'{i:2d}s:',' '.join(s[i:i+10]))"
