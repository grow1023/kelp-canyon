// Allocation sampling over N rendered frames through CDP on this project's own headless session.
// Counts every sampled JS-heap allocation, including objects that a GC already collected. Usage: bun gates/heap.mjs <cdp-ws-url>
const ws=new WebSocket(process.argv[2]);let id=0;const wait=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&wait.has(m.id)){const[res,rej]=wait.get(m.id);wait.delete(m.id);m.error?rej(new Error(m.error.message)):res(m.result)}};
await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
const send=(method,params={},sessionId)=>new Promise((res,rej)=>{wait.set(++id,[res,rej]);ws.send(JSON.stringify({id,method,params,sessionId}))});
const{targetInfos}=await send('Target.getTargets'),t=targetInfos.find(t=>t.type=='page'&&t.url.includes(':8377'));
if(!t){console.error('page target not found');process.exit(1)}
const{sessionId:S}=await send('Target.attachToTarget',{targetId:t.targetId,flatten:true});
// the expression runs once unsampled first, so the JIT has compiled the frame functions (interpreted code boxes every double)
const sample=async(expr,warm=1)=>{if(warm)await send('Runtime.evaluate',{expression:expr},S);await send('HeapProfiler.collectGarbage',{},S);
 await send('HeapProfiler.startSampling',{samplingInterval:128,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true},S);
 const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true},S);if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);
 const{profile}=await send('HeapProfiler.stopSampling',{},S);const by={};let tot=0;
 (function walk(n){if(n.selfSize){tot+=n.selfSize;const k=(n.callFrame.functionName||'(anonymous)')+':'+n.callFrame.lineNumber;by[k]=(by[k]||0)+n.selfSize}n.children.forEach(walk)})(profile.head);
 return{bytes:tot,top:Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>k+'='+v)}};
const N=3000,W=`dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));for(let k=0;k<${N};k++)__f(.004);dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));0`;
const control=await sample(`self.__k=[];for(let k=0;k<${N};k++)self.__k.push(new Float32Array(64));0`,0);
const modes={scripted:`for(let k=0;k<${N};k++)__r(-1,k*.015);0`,freeFlight:W,idle:`for(let k=0;k<${N};k++)__f(.004);0`,freeFlightAgain:W},out={frames:N,controlBytesPerAlloc:Math.round(control.bytes/N)};
// budget: the WebGPU API itself creates about 11 handle objects per frame (encoder, 7 passes, command buffer, canvas texture + view)
let bad=out.controlBytesPerAlloc<64;
for(const k in modes){const r=await sample(modes[k],0);out[k]={bytesPerFrame:Math.round(r.bytes/N),top:r.top};if(r.bytes/N>256)bad=true}
await send('Runtime.evaluate',{expression:'self.__k=null'},S);
console.log(JSON.stringify(out));ws.close();process.exit(bad?1:0);
