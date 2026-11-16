// main: WebGPU setup, passes, camera, scripted fly-through, benchmark and capture hooks.
// Per-frame code allocates nothing: uniforms, pass descriptors and logs are created once and mutated.
const QS=location.search,CAP=/cap/.test(QS),cv=document.querySelector('canvas'),hud=document.querySelector('p');
const say=s=>{hud.textContent=s;hud.hidden=!s};let bench=/bench/.test(QS);
(async()=>{
 const ad=await navigator.gpu?.requestAdapter({powerPreference:'high-performance'});
 if(!ad)return say('이 장면을 실행하려면 WebGPU가 필요합니다. Chrome 113 이상에서 열어 주십시오.');
 const TS=ad.features.has('timestamp-query'),dev=await ad.requestDevice({requiredFeatures:TS?['timestamp-query']:[]});
 dev.addEventListener('uncapturederror',e=>{console.error(e.error.message);say('GPU error: '+e.error.message.slice(0,300))});
 const ctx=cv.getContext('webgpu'),fmt=navigator.gpu.getPreferredCanvasFormat();ctx.configure({device:dev,format:fmt,alphaMode:'opaque'});
 say('바닷속 세계를 만들고 있습니다…');await new Promise(r=>setTimeout(r,30));
 buildStatic();buildProps();buildInst();stampSolid();buildChunks();
 const buf=(a,n,usage)=>{const b=dev.createBuffer({size:n*4,usage:usage|GPUBufferUsage.COPY_DST});dev.queue.writeBuffer(b,0,a,0,n);return b};
 const vb=buf(SV,nv*12,GPUBufferUsage.VERTEX),ib=buf(SI,ni,GPUBufferUsage.INDEX),nb=buf(IB,nI*8,GPUBufferUsage.VERTEX),sb=buf(SP,nS*8,GPUBufferUsage.VERTEX);
 SV=SI=null;
 const UF=new Float32Array(56),ub=dev.createBuffer({size:224,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
 // sun: fixed direction, orthographic shadow frustum over the whole playable area
 {const L=[.28,.94,.2],l=hypot(...L),lx=L[0]/l,ly=L[1]/l,lz=L[2]/l,rl=hypot(lz,lx),rx=lz/rl,rz=-lx/rl,ux=ly*rz,uy=lz*rx-lx*rz,uz=-ly*rx,E=150,D=340,cx=0,cy=-28,cz=-30;
  UF.set([rx/E,ux/E,-lx/D,0, 0,uy/E,-ly/D,0, rz/E,uz/E,-lz/D,0, -(cx*rx+cz*rz)/E,-(cx*ux+cy*uy+cz*uz)/E,.5+(cx*lx+cy*ly+cz*lz)/D,1],16);UF.set([lx,ly,lz,0],36)}
 const mod=dev.createShaderModule({code:WGSL});
 mod.getCompilationInfo().then(i=>i.messages.forEach(m=>m.type=='error'&&console.error('WGSL '+m.lineNum+':'+m.linePos+' '+m.message)));
 const at=(n,o,f)=>({shaderLocation:n,offset:o,format:f}),HDR='rgba16float',DF='depth32float';
 const VB=[{arrayStride:48,attributes:[at(0,0,'float32x3'),at(1,12,'float32x3'),at(2,24,'float32x3'),at(3,36,'float32x3')]},{arrayStride:32,stepMode:'instance',attributes:[at(4,0,'float32x4'),at(5,16,'float32x4')]}];
 const pipe=(vs,fs,format,o={})=>dev.createRenderPipeline({layout:'auto',vertex:{module:mod,entryPoint:vs,buffers:o.b||[]},fragment:fs?{module:mod,entryPoint:fs,targets:[{format,blend:o.bl}]}:void 0,
  primitive:{topology:o.t||'triangle-list'},depthStencil:o.d,multisample:{count:o.m||1}});
 const dz=(w,x)=>({format:DF,depthWriteEnabled:w,depthCompare:'less',...x}),pm={operation:'add',srcFactor:'one',dstFactor:'one-minus-src-alpha'};
 const pC=pipe('vsF','fsC','r16float'),pS=pipe('vsS',0,0,{b:VB,d:dz(true,{depthBias:2,depthBiasSlopeScale:2})}),pM=pipe('vsM','fsM',HDR,{b:VB,m:4,d:dz(true)}),pW=pipe('vsW','fsW',HDR,{m:4,d:dz(true)}),pK=pipe('vsK','fsK',HDR,{m:4,d:dz(true)}),
  pP=pipe('vsP','fsP',HDR,{b:[{arrayStride:32,stepMode:'instance',attributes:[at(0,0,'float32x4'),at(1,16,'float32x4')]}],t:'triangle-strip',m:4,d:dz(false),bl:{color:pm,alpha:pm}}),
  pR=pipe('vsF','fsR',HDR),pB=pipe('vsF','fsB',HDR),pO=pipe('vsF','fsO',fmt);
 const tex=(w,h,format,n=1)=>dev.createTexture({size:[w,h],format,sampleCount:n,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}).createView();
 const shV=tex(4096,4096,DF),caV=tex(512,512,'r16float'),lin=dev.createSampler({magFilter:'linear',minFilter:'linear'}),rep=dev.createSampler({magFilter:'linear',minFilter:'linear',addressModeU:'repeat',addressModeV:'repeat'}),cmp=dev.createSampler({compare:'less',magFilter:'linear',minFilter:'linear'});
 const bg=(p,r)=>dev.createBindGroup({layout:p.getBindGroupLayout(0),entries:Object.entries(r).map(([b,resource])=>({binding:+b,resource}))});
 const U0={0:{buffer:ub}},gC=bg(pC,U0),gS=bg(pS,U0),gW=bg(pW,U0),gK=bg(pK,U0),gP=bg(pP,U0),gM=bg(pM,{...U0,1:shV,2:cmp,3:caV,4:rep});
 // preallocated pass descriptors; size-dependent views are swapped in on resize, the canvas view every frame
 const ca=(clearValue)=>({view:null,resolveTarget:void 0,clearValue,loadOp:'clear',storeOp:'store'});
 const dC={colorAttachments:[ca()]},dS={colorAttachments:[],depthStencilAttachment:{view:shV,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}},
  dM={colorAttachments:[ca([.01,.08,.2,1])],depthStencilAttachment:{view:null,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}},dR={colorAttachments:[ca()]},dH={colorAttachments:[ca()]},dV={colorAttachments:[ca()]},dO={colorAttachments:[ca()]};
 dC.colorAttachments[0].view=caV;dM.colorAttachments[0].storeOp='discard';
 let W=0,H=0,gR,gH,gV,gO;
 const size=()=>{const w=bench?2560:min(round(innerWidth*devicePixelRatio),8192),h=bench?1440:min(round(innerHeight*devicePixelRatio),8192); // the benchmark always renders 2560x1440
  if(w==W&&h==H||!w||!h)return;W=cv.width=w;H=cv.height=h;
  const ms=tex(W,H,HDR,4),rs=tex(W,H,HDR),dp=tex(W,H,DF,4),a=tex(W>>1,H>>1,HDR),b=tex(W>>1,H>>1,HDR);
  dM.colorAttachments[0].view=ms;dM.colorAttachments[0].resolveTarget=rs;dM.depthStencilAttachment.view=dp;dR.colorAttachments[0].view=dV.colorAttachments[0].view=a;dH.colorAttachments[0].view=b;
  gR=bg(pR,{...U0,1:shV,2:cmp,3:caV,4:rep,5:dp,6:rs,8:lin});gH=bg(pB,{...U0,7:a,8:lin});gV=bg(pB,{...U0,7:b,8:lin});gO=bg(pO,{...U0,6:rs,7:a,8:lin})};
 size();addEventListener('resize',size);

 // camera state
 // C holds camera x, y, z, heading, pitch, scene time, last frame time, run start, first frame time, dt, density result.
 // It is a typed array because a double stored in a closure variable is boxed on every write.
 const C=new Float64Array(11);C.set(POSES.slice(0,5));C[7]=C[8]=-1;
 const K={KeyW:0,KeyA:0,KeyS:0,KeyD:0,KeyQ:0,KeyE:0,ShiftLeft:0,ShiftRight:0},P0=new Float32Array(3),P1=new Float32Array(3),SUB=[null],LK=new Float64Array([60,SHY+6,-26,52,-4,FLY+8,-92,40]);
 // e.code is the physical key (layout-independent). Some remote or virtual keyboards leave it empty: then the key name is used.
 const kc=e=>e.code||(e.key.length==1?'Key'+e.key.toUpperCase():e.key+'Left');
 addEventListener('keydown',e=>{const k=kc(e);if(k in K)K[k]=1});addEventListener('keyup',e=>{const k=kc(e);if(k in K)K[k]=0});addEventListener('blur',()=>{for(const k in K)K[k]=0});
 cv.addEventListener('click',()=>cv.requestPointerLock());
 document.addEventListener('pointerlockchange',()=>bench||say(document.pointerLockElement?'':HINT));
 addEventListener('mousemove',e=>{if(document.pointerLockElement){C[3]+=e.movementX*.0022;C[4]=cl(C[4]-e.movementY*.0022,-1.5,1.5)}});
 const HINT='화면을 클릭하면 시작합니다 · WASD 이동 · 마우스 시점 · Q/E 상승/하강 · Shift 가속';
 // scripted fly-through: position on the path at t seconds, looking half a key ahead
 const script=()=>{let k=C[5]/60;PU[0]=(k<0?0:k>1?1:k)*(NK-1.6);pathQ(P0,0);pathQ(P1,1);C[0]=P0[0];C[1]=P0[1];C[2]=P0[2];
  let dx=P1[0]-C[0],dy=P1[1]-C[1],dq=P1[2]-C[2],l=1/sqrt(dx*dx+dy*dy+dq*dq);dx*=l;dy*=l;dq*=l;
  // near a set piece the camera turns toward it (ship, then fluke); weights are continuous, so the view never snaps
  for(let i=0;i<8;i+=4){const ex=LK[i]-C[0],ey=LK[i+1]-C[1],ez=LK[i+2]-C[2],d=sqrt(ex*ex+ey*ey+ez*ez);let w=(LK[i+3]-d)/(LK[i+3]*.5);w=w<0?0:w>1?1:w;w*=w*(3-2*w)*.8;dx+=(ex/d-dx)*w;dy+=(ey/d-dy)*w;dq+=(ez/d-dq)*w}
  C[3]=atan2(dx,-dq);C[4]=atan2(dy,sqrt(dx*dx+dq*dq))*.8+.06};
 // rock density at the camera plus (sx,sy,sz)*0.5 m, written to C[10]
 const tdc=(sx,sy,sz)=>{const x=(C[0]+sx*.5-G0)/GH,y=(C[1]+sy*.5-GB)/GH,z=(C[2]+sz*.5-G0)/GH;let i=floor(x),j=floor(y),k=floor(z);
  i=i<0?0:i>GX-1?GX-1:i;j=j<0?0:j>GY-1?GY-1:j;k=k<0?0:k>GX-1?GX-1:k;
  let u=x-i,v=y-j,w=z-k;u=u<0?0:u>1?1:u;v=v<0?0:v>1?1:v;w=w<0?0:w>1?1:w;
  const p=i+j*SX+k*SXY,q=p+SXY,a=TD[p]+(TD[p+1]-TD[p])*u,b=TD[p+SX]+(TD[p+SX+1]-TD[p+SX])*u,c=TD[q]+(TD[q+1]-TD[q])*u,d=TD[q+SX]+(TD[q+SX+1]-TD[q+SX])*u,e=a+(b-a)*v;
  C[10]=e+(c+(d-c)*v-e)*w};
 const fly=()=>{const dt=C[9],v=(K.ShiftLeft||K.ShiftRight?24:7)*dt,f=(K.KeyW|0)-(K.KeyS|0),s=(K.KeyD|0)-(K.KeyA|0),cp=cos(C[4]);
  C[0]+=(sin(C[3])*cp*f+cos(C[3])*s)*v;C[1]+=(sin(C[4])*f+(K.KeyQ|0)-(K.KeyE|0))*v;C[2]+=(-cos(C[3])*cp*f+sin(C[3])*s)*v;
  // world bounds: rock pushes the camera out along the density gradient; a soft cylinder and the surface close the rest
  for(let i=0;i<3;i++){tdc(0,0,0);const d=C[10];if(d>1.3)break;tdc(1,0,0);let gx=C[10];tdc(-1,0,0);gx-=C[10];tdc(0,1,0);let gyy=C[10];tdc(0,-1,0);gyy-=C[10];tdc(0,0,1);let gz=C[10];tdc(0,0,-1);gz-=C[10];
   const l=(1.3-d)/(sqrt(gx*gx+gyy*gyy+gz*gz)||1);C[0]+=gx*l;C[1]+=gyy*l;C[2]+=gz*l}
  const r=sqrt(C[0]*C[0]+C[2]*C[2]);if(r>128){C[0]*=128/r;C[2]*=128/r}C[1]=C[1]<-58?-58:C[1]>-1.2?-1.2:C[1]};
 const uniforms=()=>{const ty=.5774,tx=ty*W/H,cp=cos(C[4]),fx=sin(C[3])*cp,fy=sin(C[4]),fz=-cos(C[3])*cp,rx=cos(C[3]),rz=sin(C[3]),ux=-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy,n=.15,f=700,A=f/(f-n),B=A*n,cf=C[0]*fx+C[1]*fy+C[2]*fz;
  UF[0]=rx/tx;UF[1]=ux/ty;UF[2]=fx*A;UF[3]=fx;UF[4]=0;UF[5]=uy/ty;UF[6]=fy*A;UF[7]=fy;UF[8]=rz/tx;UF[9]=uz/ty;UF[10]=fz*A;UF[11]=fz;
  UF[12]=-(C[0]*rx+C[2]*rz)/tx;UF[13]=-(C[0]*ux+C[1]*uy+C[2]*uz)/ty;UF[14]=-cf*A-B;UF[15]=-cf;
  UF[32]=C[0];UF[33]=C[1];UF[34]=C[2];UF[35]=C[5];UF[40]=W;UF[41]=H;UF[42]=n;UF[43]=f;UF[44]=rx*tx;UF[45]=0;UF[46]=rz*tx;UF[48]=ux*ty;UF[49]=uy*ty;UF[50]=uz*ty;UF[52]=fx;UF[53]=fy;UF[54]=fz};
 // frustum culling: VIS[k]=1 when the bounding sphere of draw k touches the view frustum. Arithmetic on typed arrays only.
 const ND=DR.length/5,VIS=new Uint8Array(ND);
 const cull=()=>{const ty=.5774,tx=ty*W/H,ix=1/sqrt(1+tx*tx),iy=1/sqrt(1+ty*ty),fx=UF[52],fy=UF[53],fz=UF[54];
  for(let k=0;k<ND;k++){const j=k*4,dx=CH[j]-C[0],dy=CH[j+1]-C[1],dz=CH[j+2]-C[2],r=CH[j+3],pf=dx*fx+dy*fy+dz*fz,pr=abs(dx*UF[44]+dz*UF[46])/tx,pu=abs(dx*UF[48]+dy*UF[49]+dz*UF[50])/ty;
   VIS[k]=pf>-r&&(tx*pf-pr)*ix>-r&&(ty*pf-pu)*iy>-r?1:0}};
 // the shadow pass draws every caster: an object outside the view can still shade what is inside
 const scene=(p,sh)=>{p.setVertexBuffer(0,vb);p.setVertexBuffer(1,nb);p.setIndexBuffer(ib,'uint32');for(let k=0,i=0;k<ND;k++,i+=5)if(sh?DR[i+4]:VIS[k])p.drawIndexed(DR[i],DR[i+1],DR[i+2],0,DR[i+3])};
 const tri=(e,d,pl,g,k)=>{const p=e.beginRenderPass(d);p.setPipeline(pl);p.setBindGroup(0,g);p.draw(3,1,0,k);p.end()};
 const render=log=>{uniforms();cull();dev.queue.writeBuffer(ub,0,UF);const e=dev.createCommandEncoder();
  tri(e,dC,pC,gC,0);
  let p=e.beginRenderPass(dS);p.setPipeline(pS);p.setBindGroup(0,gS);scene(p,1);p.end();
  p=e.beginRenderPass(dM);p.setPipeline(pM);p.setBindGroup(0,gM);scene(p,0);p.setPipeline(pW);p.setBindGroup(0,gW);p.draw(3);p.setPipeline(pK);p.setBindGroup(0,gK);p.draw(3);
  p.setPipeline(pP);p.setBindGroup(0,gP);p.setVertexBuffer(0,sb);p.draw(4,nS);p.end();
  tri(e,dR,pR,gR,0);tri(e,dH,pB,gH,0);tri(e,dV,pB,gV,1);
  dO.colorAttachments[0].view=ctx.getCurrentTexture().createView();tri(e,dO,pO,gO,0);
  if(log&&qs)e.resolveQuerySet(qs,0,2,qb,nf*16);
  SUB[0]=e.finish();dev.queue.submit(SUB)};

 // warm-up: run the per-frame math until the optimizing JIT has compiled it (unoptimized code boxes every double).
 // Odd steps start inside rock or outside the bounds, so the collision branches get compiled too.
 for(let i=0;i<3e4;i++){C[5]=i*.002;script();uniforms();cull();C[9]=.004;K.KeyW=i>>9&1;if(i&1)C[1]=-55;if(i&2)C[0]=140;fly()}
 K.KeyW=0;C.set(POSES.slice(0,5));C[5]=0;
 // GPU timing: two timestamps per frame are resolved into one large buffer and read back once after the C[7]
 const NF=1<<15,ft=new Float32Array(NF);let nf=0,qs,qb;
 if(TS&&bench){qs=dev.createQuerySet({type:'timestamp',count:2});qb=dev.createBuffer({size:NF*16,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC});
  dC.timestampWrites={querySet:qs,beginningOfPassWriteIndex:0};dO.timestampWrites={querySet:qs,endOfPassWriteIndex:1}}
 const stat=(a,lim)=>{let s=0,o=0;const n=a.length;for(let i=0;i<n;i++){s+=a[i];o+=a[i]>lim}a.sort();const r=x=>+x.toFixed(2);return{avg:r(s/n),p99:r(a[floor(n*.99)]),max:r(a[n-1]),over:o}};
 const done=async()=>{console.timeStamp('bench1');const r={resolution:W+'x'+H,frames:nf,seconds:+C[5].toFixed(1),adapter:[ad.info.vendor,ad.info.architecture,ad.info.device,ad.info.description].join(' ').trim(),frame:stat(ft.slice(0,nf),16.7)};
  if(qs){const rb=dev.createBuffer({size:nf*16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),e=dev.createCommandEncoder();e.copyBufferToBuffer(qb,0,rb,0,nf*16);dev.queue.submit([e.finish()]);
   await rb.mapAsync(GPUMapMode.READ);const q=new BigUint64Array(rb.getMappedRange()),g=new Float32Array(nf);for(let i=0;i<nf;i++)g[i]=Number(q[i*2+1]-q[i*2])/1e6;r.gpu=stat(g,16.7)}
  r.pass=!!r.gpu&&r.gpu.avg<=11&&r.gpu.max<=16.7&&r.frame.max<=16.7;window.__bench=r;console.log('BENCH '+JSON.stringify(r));
  const l=(n,s)=>s?`${n}: 평균 ${s.avg} ms · 99% ${s.p99} ms · 최대 ${s.max} ms · 16.7 ms 초과 ${s.over}회`:n+': 측정할 수 없습니다 (timestamp-query 미지원)';
  say(`${r.seconds}초 비행 측정 완료 (${r.resolution}, ${nf}프레임)\n${l('GPU 시간',r.gpu)}\n${l('프레임 간격',r.frame)}\n기준(GPU 평균 11 ms 이하, 16.7 ms 초과 0회): ${r.pass?'통과':'미달'}`)};
 const frame=now=>{requestAnimationFrame(frame);if(C[8]<0)C[8]=C[6]=now;const dt=(now-C[6])/1e3;C[9]=dt>.1?.1:dt;let log=0;
  if(C[7]>=0){const t=(now-C[7])/1e3;if(t>=60||nf>=NF){C[5]=t;C[7]=-1;bench=0;done()}else{ft[nf]=now-C[6];C[5]=t;script();log=1}}
  else if(bench){C[5]=0;script();if(now-C[8]>3e3){C[7]=now;console.timeStamp('bench0')}}
  else{C[5]+=C[9];fly()}
  C[6]=now;render(log);nf+=log};
 // capture hook: render pose i (or script time t when i<0) at scene time t; a driver outside the page saves the pixels
 if(CAP){self.__d=dev;self.__c=C;self.__v=()=>{let n=0,t=0;for(let k=0;k<ND;k++)if(VIS[k]){n++;t+=DR[k*5]*DR[k*5+1]/3}return[n,ND,Math.round(t)]};self.__f=dt=>{C[5]+=dt;C[9]=dt;fly();render(0)};self.__r=(i,t,y)=>{C[5]=t;if(i<0)script();else{i*=5;C[0]=POSES[i];C[1]=POSES[i+1];C[2]=POSES[i+2];C[3]=POSES[i+3]+(y||0);C[4]=POSES[i+4]}size();render(0)};return say('')}
 if(/dbg/.test(QS))self.__c=C; // test hook: camera state, read-only use
 say(bench?'60초 비행 성능을 측정하고 있습니다…':HINT);requestAnimationFrame(frame);
})().catch(e=>{console.error(e);say('장면을 시작하지 못했습니다: '+e.message)});
