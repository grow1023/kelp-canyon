// main: WebGPU setup, passes, camera, menu, dynamic resolution, sound, scripted fly-through, benchmark and capture hooks.
// Per-frame code allocates nothing: uniforms, pass descriptors and logs are created once and mutated.
const CAP=/cap/.test(QS),DBG=/dbg/.test(QS),$=s=>document.querySelector(s),cv=$('canvas'),hud=$('#hud'),ui=$('#ui');
const say=s=>{hud.textContent=s;hud.hidden=!s};let bench=/bench/.test(QS);
const AA=LV>1?1:4,SMS=LV?2048:4096,RAYN=LV>1?12:32; // Low: no multisampling, fewer light-shaft steps. Medium and Low: smaller shadow map.
(async()=>{
 const ad=await navigator.gpu?.requestAdapter({powerPreference:'high-performance'});
 if(!ad)throw Error('이 장면을 실행하려면 WebGPU가 필요합니다. 최신 Chrome 또는 Edge에서 열어 주십시오.');
 const TS=ad.features.has('timestamp-query'),dev=await ad.requestDevice({requiredFeatures:TS?['timestamp-query']:[]});
 dev.addEventListener('uncapturederror',e=>{console.error(e.error.message);say('GPU error: '+e.error.message.slice(0,300))});
 const ctx=cv.getContext('webgpu'),fmt=navigator.gpu.getPreferredCanvasFormat();ctx.configure({device:dev,format:fmt,alphaMode:'opaque'});
 const BU=GPUBufferUsage,step=(f,t)=>{GT&&GT.push(round(performance.now()-t0));$('#bar').style.width=f*100+'%';$('#st').textContent=t;return new Promise(r=>setTimeout(r,20))};
 if(CAP||bench)ui.hidden=true;
 // terrain density on the GPU: one compute pass fills the grid, the page reads it back.
 // GT = [share of mismatching samples, milliseconds, then the clock at the start of every loading step].
 let D0=null,LT=0;const GT=[-1,0],t0=performance.now();
 await step(.05,'지형을 계산하고 있습니다');
 try{const sx=GX+1,sy=GY+1,n=sx*sy*sx,pl=await dev.createComputePipelineAsync({layout:'auto',compute:{module:dev.createShaderModule({code:WGSLD}),entryPoint:'cT'}}),
   sb=dev.createBuffer({size:n*4,usage:BU.STORAGE|BU.COPY_SRC}),rb=dev.createBuffer({size:n*4,usage:BU.MAP_READ|BU.COPY_DST}),pb=dev.createBuffer({size:32,usage:BU.UNIFORM|BU.COPY_DST}),pa=new ArrayBuffer(32);
  new Float32Array(pa,0,4).set([G0,GB,G0,GH]);new Uint32Array(pa,16,4).set([sx,sy,sx,0]);dev.queue.writeBuffer(pb,0,pa);
  const e=dev.createCommandEncoder(),p=e.beginComputePass();p.setPipeline(pl);p.setBindGroup(0,dev.createBindGroup({layout:pl.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:sb}},{binding:1,resource:{buffer:pb}}]}));
  p.dispatchWorkgroups(Math.ceil(sx/4),Math.ceil(sy/4),Math.ceil(sx/4));p.end();e.copyBufferToBuffer(sb,0,rb,0,n*4);dev.queue.submit([e.finish()]);
  await rb.mapAsync(GPUMapMode.READ);D0=new Float32Array(rb.getMappedRange().slice(0));rb.destroy();sb.destroy();
  // check against the CPU formula at 500 grid points. Float precision can flip a branch far from the surface, so a few misses are allowed.
  let bad=0;for(let i=0;i<500;i++){const q=i*104729%n,a=q%sx,b=floor(q/sx)%sy,c=floor(q/(sx*sy));if(!(abs(D0[q]-T(G0+a*GH,GB+b*GH,G0+c*GH))<.05))bad++}
  GT[0]=bad/500;GT[1]=round(performance.now()-t0);if(bad>10){console.warn('GPU terrain differs from the CPU formula at '+bad+' of 500 points: using the CPU');D0=null}
 }catch(e){console.warn('GPU terrain failed: using the CPU',e)}
 await step(.2,'암반을 깎고 있습니다');bs0(D0);
 await step(.4,'바위를 띄우고 있습니다');bs1();
 await step(.48,'난파선을 가라앉히고 있습니다');bs2();
 await step(.7,'고래 꼬리를 조각하고 있습니다');bs3();
 await step(.8,'해초를 심고 있습니다');buildProps();buildInst();stampSolid();buildChunks();
 await step(.95,'빛을 준비하고 있습니다');
 const LEAF=leaves(),buf=(a,n,usage)=>{const b=dev.createBuffer({size:n*4,usage:usage|BU.COPY_DST});dev.queue.writeBuffer(b,0,a,0,n);return b};
 const vb=buf(SV,nv*12,BU.VERTEX),ib=buf(SI,ni,BU.INDEX),nb=buf(IB,nI*8,BU.VERTEX),sb=buf(SP,nS*8,BU.VERTEX);
 SV=SI=null;
 const UF=new Float32Array(56),ub=dev.createBuffer({size:224,usage:BU.UNIFORM|BU.COPY_DST});
 // sun: fixed direction, orthographic shadow frustum over the whole playable area
 {const L=[.28,.94,.2],l=hypot(...L),lx=L[0]/l,ly=L[1]/l,lz=L[2]/l,rl=hypot(lz,lx),rx=lz/rl,rz=-lx/rl,ux=ly*rz,uy=lz*rx-lx*rz,uz=-ly*rx,E=150,D=340,cx=0,cy=-28,cz=-30;
  UF.set([rx/E,ux/E,-lx/D,0, 0,uy/E,-ly/D,0, rz/E,uz/E,-lz/D,0, -(cx*rx+cz*rz)/E,-(cx*ux+cy*uy+cz*uz)/E,.5+(cx*lx+cy*ly+cz*lz)/D,1],16);UF.set([lx,ly,lz,0],36)}
 let code=WGSL.replace('RN=32','RN='+RAYN).replace('SM=4096.','SM='+SMS+'.');if(AA<2)code=code.replace('texture_depth_multisampled_2d','texture_depth_2d');
 const mod=dev.createShaderModule({code});
 mod.getCompilationInfo().then(i=>i.messages.forEach(m=>m.type=='error'&&console.error('WGSL '+m.lineNum+':'+m.linePos+' '+m.message)));
 const at=(n,o,f)=>({shaderLocation:n,offset:o,format:f}),HDR='rgba16float',DF_='depth32float';
 const VB=[{arrayStride:48,attributes:[at(0,0,'float32x3'),at(1,12,'float32x3'),at(2,24,'float32x3'),at(3,36,'float32x3')]},{arrayStride:32,stepMode:'instance',attributes:[at(4,0,'float32x4'),at(5,16,'float32x4')]}];
 const pipe=(vs,fs,format,o={})=>dev.createRenderPipeline({layout:'auto',vertex:{module:mod,entryPoint:vs,buffers:o.b||[]},fragment:fs?{module:mod,entryPoint:fs,targets:[{format,blend:o.bl}]}:void 0,
  primitive:{topology:o.t||'triangle-list'},depthStencil:o.d,multisample:{count:o.m||1}});
 const dz=(w,x)=>({format:DF_,depthWriteEnabled:w,depthCompare:'less',...x}),pm={operation:'add',srcFactor:'one',dstFactor:'one-minus-src-alpha'};
 const pC=pipe('vsF','fsC','r16float'),pS=pipe('vsS',0,0,{b:VB,d:dz(true,{depthBias:2,depthBiasSlopeScale:2})}),pM=pipe('vsM','fsM',HDR,{b:VB,m:AA,d:dz(true)}),pW=pipe('vsW','fsW',HDR,{m:AA,d:dz(true)}),pK=pipe('vsK','fsK',HDR,{m:AA,d:dz(true)}),
  pP=pipe('vsP','fsP',HDR,{b:[{arrayStride:32,stepMode:'instance',attributes:[at(0,0,'float32x4'),at(1,16,'float32x4')]}],t:'triangle-strip',m:AA,d:dz(false),bl:{color:pm,alpha:pm}}),
  pR=pipe('vsF','fsR',HDR),pB=pipe('vsF','fsB',HDR),pO=pipe('vsF','fsO',fmt);
 // size-dependent textures are collected in TX and destroyed when the render size changes
 const TX=[],tex=(w,h,format,n=1,k)=>{const t=dev.createTexture({size:[w,h],format,sampleCount:n,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});k&&TX.push(t);return t.createView()};
 const shV=tex(SMS,SMS,DF_),caV=tex(512,512,'r16float'),lin=dev.createSampler({magFilter:'linear',minFilter:'linear'}),rep=dev.createSampler({magFilter:'linear',minFilter:'linear',addressModeU:'repeat',addressModeV:'repeat'}),cmp=dev.createSampler({compare:'less',magFilter:'linear',minFilter:'linear'});
 const bg=(p,r)=>dev.createBindGroup({layout:p.getBindGroupLayout(0),entries:Object.entries(r).map(([b,resource])=>({binding:+b,resource}))});
 const U0={0:{buffer:ub}},gC=bg(pC,U0),gS=bg(pS,U0),gW=bg(pW,U0),gK=bg(pK,U0),gP=bg(pP,U0),gM=bg(pM,{...U0,1:shV,2:cmp,3:caV,4:rep});
 // preallocated pass descriptors; size-dependent views are swapped in on resize, the canvas view every frame
 const ca=(clearValue)=>({view:null,resolveTarget:void 0,clearValue,loadOp:'clear',storeOp:'store'});
 const dC={colorAttachments:[ca()]},dS={colorAttachments:[],depthStencilAttachment:{view:shV,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}},
  dM={colorAttachments:[ca([.01,.08,.2,1])],depthStencilAttachment:{view:null,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}},dR={colorAttachments:[ca()]},dH={colorAttachments:[ca()]},dV={colorAttachments:[ca()]},dO={colorAttachments:[ca()]};
 dC.colorAttachments[0].view=caV;if(AA>1)dM.colorAttachments[0].storeOp='discard';
 // Dynamic resolution ladder: pairs of (render scale, draw distance scale). A slow machine goes down the ladder: pixels first,
 // then draw distance, then the remaining pixels. The canvas keeps its full size (CW x CH); the last pass scales W x H up to it.
 const LAD=[1,1,.87,1,.75,1,.66,1,.66,.85,.66,.7,.57,.7,.5,.7],NL=LAD.length/2;
 let W=0,H=0,CW=0,CH=0,LI=TEST?0:SVD[1]?cl(+SVD[1]|0,0,NL-1):LV>1?3:0,gR,gH,gV,gO;
 const size=()=>{const cw=bench?2560:min(round(innerWidth*devicePixelRatio),8192),ch=bench?1440:min(round(innerHeight*devicePixelRatio),8192); // the benchmark always renders 2560x1440
  if(!cw||!ch)return;if(cw!=CW||ch!=CH){CW=cv.width=cw;CH=cv.height=ch}
  const w=max(round(cw*LAD[LI*2])&~1,2),h=max(round(ch*LAD[LI*2])&~1,2);if(w==W&&h==H)return;W=w;H=h;
  for(const t of TX)t.destroy();TX.length=0;
  const rs=tex(W,H,HDR,1,1),ms=AA>1?tex(W,H,HDR,AA,1):rs,dp=tex(W,H,DF_,AA,1),a=tex(W>>1,H>>1,HDR,1,1),b=tex(W>>1,H>>1,HDR,1,1);
  dM.colorAttachments[0].view=ms;dM.colorAttachments[0].resolveTarget=AA>1?rs:void 0;dM.depthStencilAttachment.view=dp;dR.colorAttachments[0].view=dV.colorAttachments[0].view=a;dH.colorAttachments[0].view=b;
  gR=bg(pR,{...U0,1:shV,2:cmp,3:caV,4:rep,5:dp,6:rs,8:lin});gH=bg(pB,{...U0,7:a,8:lin});gV=bg(pB,{...U0,7:b,8:lin});gO=bg(pO,{...U0,6:rs,7:a,8:lin})};
 size();addEventListener('resize',size);

 // camera state
 // C holds camera x, y, z, heading, pitch, scene time, last frame time, run start, first frame time, dt, density result.
 // S holds the tuning state: frame time sum, frame count, GPU ms, last tuning time, upgrade lock time, query slot, touch forward, touch strafe, good seconds, last upgrade time.
 // Both are typed arrays because a double stored in a closure variable is boxed on every write.
 const C=new Float64Array(11),S=new Float64Array(10);C.set(POSES.slice(0,5));C[7]=C[8]=-1;
 const K={KeyW:0,KeyA:0,KeyS:0,KeyD:0,KeyQ:0,KeyE:0,ShiftLeft:0,ShiftRight:0},P0=new Float32Array(3),P1=new Float32Array(3),SUB=[null],LK=new Float64Array([60,SHY+6,-26,52,-4,FLY+8,-92,40]);
 let menu=CAP||bench?0:1,touch=MOB?1:0,snd=1,AC=null,MG=null,stats=0;
 const showMenu=m=>{menu=m;ui.hidden=!m;$('#mb').hidden=!!m||!touch;if(m){for(const k in K)K[k]=0;S[6]=S[7]=0}};
 const mute=()=>{snd^=1;if(MG)MG.gain.value=snd?.5:0;$('#snd').textContent=snd?'소리 켜짐':'소리 꺼짐';$('#snd').setAttribute('aria-pressed',!!snd)};
 // e.code is the physical key (layout-independent). Some remote or virtual keyboards leave it empty: then the key name is used.
 const kc=e=>e.code||(e.key.length==1?'Key'+e.key.toUpperCase():e.key+'Left');
 addEventListener('keydown',e=>{const k=kc(e);if(k=='KeyM'&&!e.repeat)mute();if(menu)return;
  if(k in K)K[k]=1;else if(/^Digit[1-6]$/.test(k)){const i=(k[5]-1)*5;for(let j=0;j<5;j++)C[j]=POSES[i+j]}else if(k=='KeyH'&&!e.repeat){stats^=1;say('')}});
 addEventListener('keyup',e=>{const k=kc(e);if(k in K)K[k]=0});addEventListener('blur',()=>{for(const k in K)K[k]=0});
 // the sound starts with the first dive (a browser allows audio only after a click). Test modes stay silent.
 $('#go').onclick=()=>{if(!AC&&!TEST)try{AC=new AudioContext;MG=au(AC);MG.gain.value=snd?.5:0}catch(e){console.warn(e)}
  if(touch)showMenu(0);else cv.requestPointerLock()?.catch?.(()=>{})};
 $('#snd').onclick=mute;$('#mb').onclick=()=>showMenu(1);
 for(const b of document.querySelectorAll('[data-q]')){b.setAttribute('aria-pressed',b.dataset.q==LV);b.onclick=()=>{keep('kelp',b.dataset.q);location.reload()}}
 document.addEventListener('pointerlockchange',()=>{if(!touch&&!bench&&!CAP)showMenu(document.pointerLockElement?0:1)});
 addEventListener('mousemove',e=>{if(document.pointerLockElement){C[3]+=e.movementX*.0022;C[4]=cl(C[4]-e.movementY*.0022,-1.5,1.5)}});
 // touch: the left half of the screen is a move stick (drag from where the finger landed), the right half turns the view
 const TI=[-1,0,0,-1,0,0],tend=e=>{for(const t of e.changedTouches){if(t.identifier==TI[0]){TI[0]=-1;S[6]=S[7]=0}if(t.identifier==TI[3])TI[3]=-1}};
 addEventListener('touchstart',()=>{touch=1},{once:true,passive:true});
 cv.addEventListener('touchstart',e=>{e.preventDefault();if(menu)return;for(const t of e.changedTouches){
  if(t.clientX<innerWidth/2&&TI[0]<0){TI[0]=t.identifier;TI[1]=t.clientX;TI[2]=t.clientY}else if(TI[3]<0){TI[3]=t.identifier;TI[4]=t.clientX;TI[5]=t.clientY}}},{passive:false});
 cv.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches){
  if(t.identifier==TI[0]){S[7]=cl((t.clientX-TI[1])/60,-1,1);S[6]=cl((TI[2]-t.clientY)/60,-1,1)}
  else if(t.identifier==TI[3]){C[3]+=(t.clientX-TI[4])*.005;C[4]=cl(C[4]-(t.clientY-TI[5])*.005,-1.5,1.5);TI[4]=t.clientX;TI[5]=t.clientY}}},{passive:false});
 cv.addEventListener('touchend',tend);cv.addEventListener('touchcancel',tend);
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
 const fly=()=>{const dt=C[9],v=(K.ShiftLeft||K.ShiftRight?24:7)*dt,f=(K.KeyW|0)-(K.KeyS|0)+S[6],s=(K.KeyD|0)-(K.KeyA|0)+S[7],cp=cos(C[4]);
  C[0]+=(sin(C[3])*cp*f+cos(C[3])*s)*v;C[1]+=(sin(C[4])*f+(K.KeyQ|0)-(K.KeyE|0))*v;C[2]+=(-cos(C[3])*cp*f+sin(C[3])*s)*v;
  // world bounds: rock pushes the camera out along the density gradient; a soft cylinder and the surface close the rest
  for(let i=0;i<3;i++){tdc(0,0,0);const d=C[10];if(d>1.3)break;tdc(1,0,0);let gx=C[10];tdc(-1,0,0);gx-=C[10];tdc(0,1,0);let gyy=C[10];tdc(0,-1,0);gyy-=C[10];tdc(0,0,1);let gz=C[10];tdc(0,0,-1);gz-=C[10];
   const l=(1.3-d)/(sqrt(gx*gx+gyy*gyy+gz*gz)||1);C[0]+=gx*l;C[1]+=gyy*l;C[2]+=gz*l}
  const r=sqrt(C[0]*C[0]+C[2]*C[2]);if(r>128){C[0]*=128/r;C[2]*=128/r}C[1]=C[1]<-58?-58:C[1]>-1.2?-1.2:C[1]};
 const uniforms=()=>{const ty=.5774,tx=ty*W/H,cp=cos(C[4]),fx=sin(C[3])*cp,fy=sin(C[4]),fz=-cos(C[3])*cp,rx=cos(C[3]),rz=sin(C[3]),ux=-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy,n=.15,f=700,A=f/(f-n),B=A*n,cf=C[0]*fx+C[1]*fy+C[2]*fz;
  UF[0]=rx/tx;UF[1]=ux/ty;UF[2]=fx*A;UF[3]=fx;UF[4]=0;UF[5]=uy/ty;UF[6]=fy*A;UF[7]=fy;UF[8]=rz/tx;UF[9]=uz/ty;UF[10]=fz*A;UF[11]=fz;
  UF[12]=-(C[0]*rx+C[2]*rz)/tx;UF[13]=-(C[0]*ux+C[1]*uy+C[2]*uz)/ty;UF[14]=-cf*A-B;UF[15]=-cf;
  UF[32]=C[0];UF[33]=C[1];UF[34]=C[2];UF[35]=C[5];UF[39]=FAR.tuft[0]*LAD[LI*2+1];UF[40]=W;UF[41]=H;UF[42]=n;UF[43]=f;UF[44]=rx*tx;UF[45]=0;UF[46]=rz*tx;UF[47]=CW;UF[48]=ux*ty;UF[49]=uy*ty;UF[50]=uz*ty;UF[51]=CH;UF[52]=fx;UF[53]=fy;UF[54]=fz};
 // Culling, arithmetic on typed arrays only. VIS[k] = 0 hidden, 1 full mesh, 2 far mesh (LOD) for the view; SVI the same for the shadow pass.
 // A draw is hidden outside the view frustum or beyond its draw distance (the fog has swallowed it by then).
 // The shadow pass has no frustum test: an object outside the view can still shade what is inside.
 const ND=DR.length/7,VIS=new Uint8Array(ND),SVI=new Uint8Array(ND);
 const cull=()=>{const ty=.5774,tx=ty*W/H,ix=1/sqrt(1+tx*tx),iy=1/sqrt(1+ty*ty),fx=UF[52],fy=UF[53],fz=UF[54],det=LAD[LI*2+1];
  for(let k=0;k<ND;k++){const j=k*4,dx=CH_[j]-C[0],dy=CH_[j+1]-C[1],dz=CH_[j+2]-C[2],r=CH_[j+3],pf=dx*fx+dy*fy+dz*fz,pr=abs(dx*UF[44]+dz*UF[46])/tx,pu=abs(dx*UF[48]+dy*UF[49]+dz*UF[50])/ty,
    dd=sqrt(dx*dx+dy*dy+dz*dz)-r,near=dd<DF[k*2]*det,v=dd<DF[k*2+1]*det?1:2;
   VIS[k]=near&&pf>-r&&(tx*pf-pr)*ix>-r&&(ty*pf-pu)*iy>-r?v:0;SVI[k]=near&&DR[k*7+4]?v:0}};
 const scene=(p,V)=>{p.setVertexBuffer(0,vb);p.setVertexBuffer(1,nb);p.setIndexBuffer(ib,'uint32');
  for(let k=0,i=0;k<ND;k++,i+=7){const v=V[k];if(v==1)p.drawIndexed(DR[i],DR[i+1],DR[i+2],0,DR[i+3]);else if(v)p.drawIndexed(DR[i+5],DR[i+1],DR[i+6],0,DR[i+3])}};
 const tri=(e,d,pl,g,k)=>{const p=e.beginRenderPass(d);p.setPipeline(pl);p.setBindGroup(0,g);p.draw(3,1,0,k);p.end()};
 // GPU timing: two timestamps per frame are resolved into one large buffer. The benchmark reads it back once at the end;
 // normal play copies the last 64 frames once a second into a small buffer for the dynamic resolution.
 const NF=1<<15,ft=new Float32Array(NF);let nf=0,qs,qr,qb,rb2,want=0,busy=0;
 if(TS){qs=dev.createQuerySet({type:'timestamp',count:2});qr=dev.createBuffer({size:16,usage:BU.QUERY_RESOLVE|BU.COPY_SRC});qb=dev.createBuffer({size:NF*16,usage:BU.COPY_DST|BU.COPY_SRC});rb2=dev.createBuffer({size:1024,usage:BU.MAP_READ|BU.COPY_DST});
  dC.timestampWrites={querySet:qs,beginningOfPassWriteIndex:0};dO.timestampWrites={querySet:qs,endOfPassWriteIndex:1}}
 const onMap=()=>{const q=new BigUint64Array(rb2.getMappedRange());let s=0,n=0;for(let i=0;i<64;i++){const d=Number(q[i*2+1]-q[i*2]);if(d>0&&d<1e9){s+=d;n++}}S[2]=n?s/n/1e6:0;rb2.unmap();busy=0};
 const render=log=>{uniforms();cull();dev.queue.writeBuffer(ub,0,UF);const e=dev.createCommandEncoder();
  tri(e,dC,pC,gC,0);
  let p=e.beginRenderPass(dS);p.setPipeline(pS);p.setBindGroup(0,gS);scene(p,SVI);p.end();
  p=e.beginRenderPass(dM);p.setPipeline(pM);p.setBindGroup(0,gM);scene(p,VIS);p.setPipeline(pW);p.setBindGroup(0,gW);p.draw(3);p.setPipeline(pK);p.setBindGroup(0,gK);p.draw(3);
  p.setPipeline(pP);p.setBindGroup(0,gP);p.setVertexBuffer(0,sb);p.draw(4,nS);p.end();
  tri(e,dR,pR,gR,0);tri(e,dH,pB,gH,0);tri(e,dV,pB,gV,1);
  dO.colorAttachments[0].view=ctx.getCurrentTexture().createView();tri(e,dO,pO,gO,0);
  if(qs){e.resolveQuerySet(qs,0,2,qr,0);e.copyBufferToBuffer(qr,0,qb,(log?nf:S[5]++&63)*16,16); // a resolve offset must be a multiple of 256, so each frame goes through qr
   if(want){e.copyBufferToBuffer(qb,0,rb2,0,1024);want=0;busy=2}}
  SUB[0]=e.finish();dev.queue.submit(SUB);if(busy>1){busy=1;rb2.mapAsync(GPUMapMode.READ).then(onMap)}};
 // Tuning, once a second. a = mean frame interval in ms, S[2] = mean GPU time in ms (0 when the browser cannot measure it).
 // Goal: 60 fps. Step down when frames are late or the GPU is over budget. Step up when the GPU has room;
 // without GPU timing, try a step up after six good seconds, and when that fails at once, wait a minute before the next try.
 const QN=['높음','보통','낮음'];
 const tune=now=>{const a=S[1]?S[0]/S[1]:0,g=S[2];S[0]=S[1]=0;S[3]=now;if(qs&&!busy)want=1;
  if(stats)say(`${W}×${H} · ${a?round(1e3/a):0} fps · GPU ${g?g.toFixed(1)+' ms':'측정 불가'} · 세부 ${QN[LV]} · 단계 ${LI+1}/${NL} · 잎 ${LEAF.toLocaleString()}개`);
  if(!a)return;let d=0;
  if(a>18.6||g>13.5)d=1;else if(g>0?g<8.5&&a<17.6:++S[8]>5&&a<17.6)d=-1;
  if(d>0){S[8]=0;if(now-S[9]<4e3)S[4]=now+6e4;if(LI>=NL-1)d=0}
  if(d<0&&(now<S[4]||!LI))d=0;
  if(d){LI+=d;if(d<0){S[9]=now;S[8]=0}size();if(!TEST)keep('kelp',LV+','+LI)}};

 // warm-up: run the per-frame math until the optimizing JIT has compiled it (unoptimized code boxes every double).
 // Odd steps start inside rock or outside the bounds, so the collision branches get compiled too.
 for(let i=0;i<3e4;i++){C[5]=i*.002;script();uniforms();cull();C[9]=.004;K.KeyW=i>>9&1;if(i&1)C[1]=-55;if(i&2)C[0]=140;fly()}
 K.KeyW=0;C.set(POSES.slice(0,5));C[5]=0;GT.push(round(performance.now()-t0));
 const stat=(a,lim)=>{let s=0,o=0;const n=a.length;for(let i=0;i<n;i++){s+=a[i];o+=a[i]>lim}a.sort();const r=x=>+x.toFixed(2);return{avg:r(s/n),p99:r(a[floor(n*.99)]),max:r(a[n-1]),over:o}};
 const done=async()=>{console.timeStamp('bench1');const r={resolution:W+'x'+H,frames:nf,seconds:+C[5].toFixed(1),adapter:[ad.info.vendor,ad.info.architecture,ad.info.device,ad.info.description].join(' ').trim(),frame:stat(ft.slice(0,nf),16.7)};
  if(qs){const rb=dev.createBuffer({size:nf*16,usage:BU.MAP_READ|BU.COPY_DST}),e=dev.createCommandEncoder();e.copyBufferToBuffer(qb,0,rb,0,nf*16);dev.queue.submit([e.finish()]);
   await rb.mapAsync(GPUMapMode.READ);const q=new BigUint64Array(rb.getMappedRange()),g=new Float32Array(nf);for(let i=0;i<nf;i++)g[i]=Number(q[i*2+1]-q[i*2])/1e6;r.gpu=stat(g,16.7)}
  r.pass=!!r.gpu&&r.gpu.avg<=11&&r.gpu.max<=16.7&&r.frame.max<=16.7;window.__bench=r;console.log('BENCH '+JSON.stringify(r));
  const l=(n,s)=>s?`${n}: 평균 ${s.avg} ms · 99% ${s.p99} ms · 최대 ${s.max} ms · 16.7 ms 초과 ${s.over}회`:n+': 측정할 수 없습니다 (timestamp-query 미지원)';
  say(`${r.seconds}초 비행 측정 완료 (${r.resolution}, ${nf}프레임)\n${l('GPU 시간',r.gpu)}\n${l('프레임 간격',r.frame)}\n기준(GPU 평균 11 ms 이하, 16.7 ms 초과 0회): ${r.pass?'통과':'미달'}`)};
 const frame=now=>{requestAnimationFrame(frame);if(C[8]<0)C[8]=C[6]=S[3]=now;const ms=now-C[6],dt=ms/1e3;C[9]=dt>.1?.1:dt;let log=0;
  if(C[7]>=0){const t=(now-C[7])/1e3;if(t>=60||nf>=NF){C[5]=t;C[7]=-1;bench=0;done()}else{ft[nf]=ms;C[5]=t;script();log=1}}
  else if(bench){C[5]=0;script();if(now-C[8]>3e3){C[7]=now;console.timeStamp('bench0')}}
  else{C[5]+=C[9];if(!menu)fly();if(ms<100){S[0]+=ms;S[1]++}if(now-S[3]>=1e3&&!DBG)tune(now)}
  C[6]=now;render(log);nf+=log};
 // capture hook: render pose i (or script time t when i<0) at scene time t; a driver outside the page saves the pixels
 if(CAP){self.__d=dev;self.__c=C;self.__gt=GT;self.__v=()=>{let n=0,t=0,l=0;for(let k=0;k<ND;k++)if(VIS[k]){n++;l+=VIS[k]>1;t+=DR[k*7+(VIS[k]>1?5:0)]*DR[k*7+1]/3}return[n,ND,Math.round(t),l]};self.__f=dt=>{C[5]+=dt;C[9]=dt;fly();render(0)};self.__li=i=>{LI=i;size();return W+'x'+H};
  self.__r=(i,t,y)=>{C[5]=t;if(i<0)script();else{i*=5;C[0]=POSES[i];C[1]=POSES[i+1];C[2]=POSES[i+2];C[3]=POSES[i+3]+(y||0);C[4]=POSES[i+4]}size();render(0)};return say('')}
 // test hooks: camera state (read-only use), a tuning step with given numbers, the sound graph, and the load report
 if(DBG){self.__c=C;self.__gt=GT;self.__au=au;self.__t=(a,g,now)=>{S[0]=a;S[1]=1;S[2]=g;tune(now);return LI};self.__s=()=>[W,H,CW,CH,LI,LV,LEAF,menu,LT]}
 LT=round(performance.now()-t0);await step(1,'');$('#ld').hidden=true;$('#mn').hidden=false;if(menu)$('#go').focus();
 if(bench)say('60초 비행 성능을 측정하고 있습니다…');requestAnimationFrame(frame);
})().catch(e=>{console.error(e);$('#st').textContent=e.message;say('장면을 시작하지 못했습니다: '+e.message)});
