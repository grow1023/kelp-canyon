// Controls check on the running page (normal mode + ?dbg): real CDP input events, camera state read back. Exit 1 on any failure.
// Usage: bun gates/controls.mjs <cdp-ws-url>
const ws=new WebSocket(process.argv[2]);let id=0;const wait=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&wait.has(m.id)){const[res,rej]=wait.get(m.id);wait.delete(m.id);m.error?rej(new Error(m.error.message)):res(m.result)}};
await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
const send=(method,params={},sessionId)=>new Promise((res,rej)=>{wait.set(++id,[res,rej]);ws.send(JSON.stringify({id,method,params,sessionId}))});
const{targetInfos}=await send('Target.getTargets'),t=targetInfos.find(t=>t.type=='page'&&t.url.includes(':8377'));
const{sessionId:S}=await send('Target.attachToTarget',{targetId:t.targetId,flatten:true});
const ev=async x=>(await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true},S)).result.value;
const cam=async()=>JSON.parse(await ev('JSON.stringify(Array.from(self.__c).slice(0,5))'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const VK={KeyW:87,KeyA:65,KeyS:83,KeyD:68,KeyQ:81,KeyE:69,ShiftLeft:16};
const key=(type,code,withCode=true)=>send('Input.dispatchKeyEvent',{type,key:code=='ShiftLeft'?'Shift':code.slice(3).toLowerCase(),...(withCode?{code}:{}),windowsVirtualKeyCode:VK[code]},S);
const hold=async(codes,ms,withCode)=>{const a=await cam();for(const c of codes)await key('keyDown',c,withCode);await sleep(ms);for(const c of codes)await key('keyUp',c,withCode);await sleep(250);const b=await cam();return b.map((v,i)=>v-a[i])};
const out={},fail=[];const need=(n,ok,d)=>{out[n]=d.map(v=>+v.toFixed(2));if(!ok)fail.push(n)};
const click=async(x,y)=>{await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1},S);await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1},S);await sleep(500)};
const vis=async q=>ev(`!document.querySelector('${q}').hidden`);
// menu first: the loading bar is gone, the menu is open, and keys do not move the camera behind it
out['menu open at start']=await vis('#ui')&&await vis('#mn')&&!(await vis('#ld'));if(!out['menu open at start'])fail.push('menu open at start');
let d=await hold(['KeyW'],500);need('W behind the menu: no movement',Math.hypot(d[0],d[1],d[2])<.01,d);
// dive: a real click on the button (pointer lock needs a user gesture)
const r=JSON.parse(await ev(`JSON.stringify((r=>[r.x+r.width/2,r.y+r.height/2])(document.querySelector('#go').getBoundingClientRect()))`));await click(r[0],r[1]);
const locked=await ev('document.pointerLockElement&&document.pointerLockElement.tagName');out['pointer lock']=locked;if(locked!='CANVAS')fail.push('pointer lock');
out['menu hidden after dive']=!(await vis('#ui'));if(!out['menu hidden after dive'])fail.push('menu hidden after dive');
// start: heading 0 (looks toward -z), so forward = -z, right = +x
d=await hold(['KeyW'],700);need('W forward (-z)',d[2]<-1&&Math.abs(d[0])<.5,d);const w=Math.hypot(d[0],d[1],d[2]);
d=await hold(['KeyS'],700);need('S back (+z)',d[2]>1,d);
d=await hold(['KeyA'],700);need('A left (-x)',d[0]<-1,d);
d=await hold(['KeyD'],700);need('D right (+x)',d[0]>1,d);
d=await hold(['KeyQ'],700);need('Q up (+y)',d[1]>1,d);
d=await hold(['KeyE'],700);need('E down (-y)',d[1]<-1,d);
d=await hold(['ShiftLeft','KeyW'],700);const sw=Math.hypot(d[0],d[1],d[2]);need('Shift+W faster ('+(sw/w).toFixed(1)+'x)',sw>w*2,d);
d=await hold(['KeyS'],1500,false);need('S without e.code (fallback)',d[2]>1,d);
d=await hold([],600);need('no key: no movement',Math.hypot(d[0],d[1],d[2])<.01,d);
await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:600,y:400},S);await sleep(200); // the dive click left the pointer on the button
let a=await cam();for(let i=1;i<=10;i++)await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:600+i*20,y:400},S);await sleep(300);let b=await cam();
need('mouse right: heading turns right',b[3]-a[3]>.1&&Math.abs(b[4]-a[4])<.02,[b[3]-a[3],b[4]-a[4]]);
a=b;for(let i=1;i<=10;i++)await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:800,y:400+i*15},S);await sleep(300);b=await cam();
need('mouse down: pitch goes down',b[4]-a[4]<-.1,[b[3]-a[3],b[4]-a[4]]);
for(let i=1;i<=400;i++)await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:800,y:550-i*5},S);await sleep(300);b=await cam();
need('pitch clamps below straight up',b[4]<=1.5001&&b[4]>1.4,[b[4]]);
// keys 1-6 jump to the fixed poses
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'4',code:'Digit4',windowsVirtualKeyCode:52},S);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'4',code:'Digit4',windowsVirtualKeyCode:52},S);await sleep(200);
b=await cam();need('key 4 jumps to the sculpture pose',Math.abs(b[0]-11.4)<.5&&Math.abs(b[2]+81)<.5,b);
await ev('document.exitPointerLock()');await sleep(300);out['menu returns after unlock']=await vis('#ui');if(!out['menu returns after unlock'])fail.push('menu returns');
// detail buttons: exactly one is marked as current
out['detail buttons']=await ev(`[...document.querySelectorAll('[data-q]')].map(b=>b.getAttribute('aria-pressed')).join()`);if(out['detail buttons']!='false,false,true')fail.push('detail buttons');
// dynamic resolution, driven with given numbers (frame ms, GPU ms, clock): late frames step down, pixels first; a fast GPU steps back up
const st=async()=>JSON.parse(await ev('JSON.stringify(__s())')),s0=await st();let li=[];
for(let i=0;i<5;i++)li.push(await ev(`__t(25,0,${1e6+i*1e3})`));const s1=await st();
for(let i=0;i<7;i++)li.push(await ev(`__t(12,4,${2e6+i*1e3})`));const s2=await st();
out.ladder=li.join();out.sizes=[s0,s1,s2].map(s=>s[0]+'x'+s[1]+'@'+s[4]).join(' ');
if(li.slice(0,5).join()!='1,2,3,4,5'||li[11]!=0)fail.push('ladder');if(!(s1[0]<s0[0]*.7&&s1[2]==s0[2]&&s2[0]==s0[0]))fail.push('render size follows the ladder, canvas size stays');
out.leaves=s0[6];out.loadMs=s0[8];out.gpuTerrain=JSON.parse(await ev('JSON.stringify(__gt)'));if(!(out.gpuTerrain[0]>=0&&out.gpuTerrain[0]<=.02))fail.push('GPU terrain matches the CPU formula');
if(!(s0[6]>=1e6))fail.push('leaf count');
console.log(JSON.stringify({out,fail},null,1));ws.close();process.exit(fail.length?1:0);
