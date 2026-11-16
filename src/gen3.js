// gen3: instances (x,y,z,scale, yaw,phase,tint,param) and sprites (x,y,z,size, kind,phase,a,b). All built once.
let H_=0;const IB=new Float32Array(170000*8),SP=new Float32Array(90000*8),DL=[];let nI=0,nS=0;
const inst=(x,y,z,s,yaw,ph,tint,p)=>{const o=nI++*8;IB[o]=x;IB[o+1]=y;IB[o+2]=z;IB[o+3]=s;IB[o+4]=yaw;IB[o+5]=ph;IB[o+6]=tint;IB[o+7]=p};
const spr=(x,y,z,s,k,ph,a,b)=>{const o=nS++*8;SP[o]=x;SP[o+1]=y;SP[o+2]=z;SP[o+3]=s;SP[o+4]=k;SP[o+5]=ph;SP[o+6]=a;SP[o+7]=b};
const grp=(name,f)=>{const i0=nI;f();DL.push([name,i0,nI-i0])};
// random vertex (offset into SV) in [lo,hi) with normal.y in (u0,u1] and height in (y0,y1), or -1
const pick=(u0,u1,y0,y1,pr,lo,hi)=>{for(let k=0;k<80;k++){const o=(lo+floor(R()*(hi-lo)))*12;if(SV[o+4]>u0&&SV[o+4]<=u1&&SV[o+1]>y0&&SV[o+1]<y1&&hypot(SV[o],SV[o+2])<135&&(!pr||pr(o)))return o}return-1};
// open water test with margin m: terrain, surface cap, ship, fluke, boulders
const clearAt=(x,y,z,m)=>{if(td(x,y,z)<m||y>-3.2-m)return 0;
 if(hypot(x-60,z+26)<30&&shipW(x,y,z)<m)return 0;if(hypot(x+4,z+92)<22&&flukeW(x,y,z)<m)return 0;
 for(let i=0;i<136;i+=4)if(hypot(x-BL[i],y-BL[i+1],z-BL[i+2])<BL[i+3]+m)return 0;return 1};
// swimmer orbit centre; the vertex shader repeats this formula
const orb=(o,ax,ay,az,ph,Rx,q,ky,kz)=>{o[0]=ax+sin(q+ph)*Rx;o[1]=ay+sin(2*q+ph)*ky;o[2]=az+cos(q+ph)*Rx*kz};
const orbOK=(ax,ay,az,ph,Rx,ky,kz,m)=>{for(let i=0;i<48;i++){orb(_c,ax,ay,az,ph,Rx,i/48*TAU,ky,kz);if(!clearAt(_c[0],_c[1],_c[2],m))return 0}return 1};
// smallest distance between the scripted camera and a swimmer group over the 60 s flight (w = angular speed, sp = half-spread along the orbit in radians)
const flyD=(ax,ay,az,ph,Rx,ky,kz,w,sp)=>{let m=1e9;for(let t=0;t<=60;t+=.1){pathP(t/60*(NK-1.6),_b);for(let o=-sp;o<=sp;o+=.13){orb(_c,ax,ay,az,ph,Rx,t*w+o,ky,kz);m=min(m,hypot(_c[0]-_b[0],_c[1]-_b[1],_c[2]-_b[2]))}}return m};
// smallest distance between any fixed pose and a swimmer orbit
const poseD=(ax,ay,az,ph,Rx,ky,kz)=>{let m=1e9;for(let i=0;i<64;i++){orb(_c,ax,ay,az,ph,Rx,i/64*TAU,ky,kz);for(let k=0;k<30;k+=5)m=min(m,hypot(_c[0]-POSES[k],_c[1]-POSES[k+1],_c[2]-POSES[k+2]))}return m};
// keep kelp out of a cone in front of every fixed pose (it widens with distance, so the subject of the pose stays in view),
// out of a clearing around the start position, and off the sight lines from the fly path to the ship and the sculpture
const poseOK=(x,z)=>{for(let i=0;i<30;i+=5){const dx=x-POSES[i],dz=z-POSES[i+2],fx=sin(POSES[i+3]),fz=-cos(POSES[i+3]),t=cl(dx*fx+dz*fz,0,34);if(hypot(dx-fx*t,dz-fz*t)<5+t*.13)return 0}
 if(hypot(x,z-36)<8.5)return 0;
 for(let u=0;u<NK-1.6;u+=.5){pathP(u,_b);for(let k=0;k<2;k++){const lx=k?-4:60,lz=k?-92:-26,ex=lx-_b[0],ez=lz-_b[2],L=hypot(ex,ez);if(L>(k?40:52))continue;const t=cl(((x-_b[0])*ex+(z-_b[2])*ez)/(L*L),0,1);if(hypot(x-_b[0]-ex*t,z-_b[2]-ez*t)<3.2)return 0}}return 1};
// true when a floor prop at this point would stand inside the ship or the sculpture
// true when a floor prop at this point would stand inside the ship or the sculpture
const inSet=(x,y,z)=>hypot(x-60,z+26)<30&&shipW(x,y+.4,z)<1||hypot(x+4,z+92)<12&&flukeW(x,y+.4,z)<.6;
// occupancy grid (0.5 m cells): large floor props mark their footprint; later props and the ground cover keep out of it
const OC=new Uint8Array(736*736),oci=(x,z)=>cl(floor((x+184)*2),0,735)+cl(floor((z+184)*2),0,735)*736;
const occ=(x,z,r)=>{const q=floor(r*2)+1;for(let k=-q;k<=q;k++)for(let i=-q;i<=q;i++)if(i*i+k*k<=r*r*4)OC[oci(x+i*.5,z+k*.5)]=1};
const free=(x,z,r)=>!(OC[oci(x,z)]|OC[oci(x+r,z)]|OC[oci(x-r,z)]|OC[oci(x,z+r)]|OC[oci(x,z-r)]);
function buildInst(){
 inst(0,0,0,1,0,0,0,0);DL.push(['world',0,1]);
 const near=o=>hypot(SV[o],SV[o+2]+30)<80,corr=o=>abs(SV[o])<27&&SV[o+2]>-104&&SV[o+2]<46,B0=TVN,B1=SHP[0];
 // sea-floor vertex for a prop with footprint radius q; r keeps props away from the lens of every fixed pose
 const flr=(up,y1,i,r,q)=>{const o=pick(up,2,-60,y1,i%2?near:0,0,TVN);if(o<0||inSet(SV[o],SV[o+1],SV[o+2])||!free(SV[o],SV[o+2],q))return-1;
  for(let k=0;k<30;k+=5)if(hypot(SV[o]-POSES[k],SV[o+2]-POSES[k+2])<r)return-1;return o};
 const wall=()=>pick(.08,.6,-58,-7,near,0,TVN); // steep rock faces near the route
 const top=(lo,hi,up)=>pick(up,2,-99,0,0,lo,hi); // up-facing parts of a mesh range (boulders, ship, sculpture)
 const on=(o,dn,dy,s,ph)=>inst(SV[o]-SV[o+3]*dn,SV[o+1]-dy,SV[o+2]-SV[o+5]*dn,s,R()*TAU,ph,R(),0);
 grp('sponge',()=>{for(let i=0;i<280;i++){const s=RR(.7,2.3),o=flr(.8,-8,i,7,s*.5);if(o>=0){on(o,0,.1,s,0);occ(SV[o],SV[o+2],s*.6+.3)}}});
 grp('mound',()=>{for(let i=0;i<320;i++){const s=RR(.5,1.9),o=flr(.8,-3.5,i,3.5,s*.7);if(o>=0){on(o,0,.2*s,s,0);occ(SV[o],SV[o+2],s*1.1+.2)}}
  for(let i=0;i<300;i++){const o=wall();if(o>=0){const s=RR(.5,1.4);on(o,.35*s,SV[o+4]*.35*s,s,0)}}});
 grp('kelp',()=>{const k0=nI;for(let c=0;c<2600&&nI-k0<2400;c++){const o=pick(.8,2,-60,-39,c%2?corr:0,0,TVN);if(o<0)continue;const cx=SV[o],cz=SV[o+2],n=5+floor(R()*9);
  for(let i=0;i<n;i++){const a=R()*TAU,r=RR(0,8),x=cx+sin(a)*r,z=cz+cos(a)*r,y=gy(x,z);
   if(y>-38||!poseOK(x,z)||pathD(x,0,z,1)<6.3||hypot(x-60,z+26)<20||hypot(x+4,z+92)<13)continue;
   H_=R(); // heights in three classes, so the forest has an uneven canopy
   let H=min(H_<.3?RR(9,17):H_<.75?RR(17,29):RR(29,40),-5-y);for(let h=5;h<H;h+=3)if(!clearAt(x,y+h,z,1.6)){H=h-3;break}
   if(H<9)continue;
   inst(x,y-.4,z,H/30,R()*TAU,R()*TAU,R(),0);
   for(let j=0;j<26&&nS<70000;j+=THIN){const b=R()*TAU,q=RR(.3,2.8);spr(x+sin(b)*q,y+RR(1,H),z+cos(b)*q,RR(.04,.09),2,R(),R(),R())}}}});
 grp('bush',()=>{
  for(let i=0;i<3400;i++){const s=RR(.7,1.7),o=flr(.72,-3,i,2.6,s*.8);if(o>=0){on(o,0,.08,s,R()*TAU);occ(SV[o],SV[o+2],s*.9)}} // rosettes keep apart
  for(let i=0;i<1500;i++){const o=wall();if(o>=0){const s=RR(.6,1.5);on(o,.2*s,.25*s,s,R()*TAU)}} // growth on the canyon walls
  for(let i=0;i<260;i++){const o=i%3?top(B0,B1,.6):i%2?top(SHP[0],SHP[1],.75):top(FLK[0],FLK[1],.8);if(o>=0)on(o,0,.06,RR(.35,.9),R()*TAU)}});
 // ground cover: jittered in the tangent plane of the picked vertex so tufts do not stack. It stays out of the big props,
 // and it gets sparse and short toward the edge of a patch. Moss on the boulders.
 grp('tuft',()=>{for(let i=0;i<300000;i+=THIN){const o=pick(.8,2,-60,-3,i%2?near:0,0,TVN);if(o<0)continue;const dx=RR(-.8,.8),dz=RR(-.8,.8),x=SV[o]+dx,z=SV[o+2]+dz,c=cov(x,z);
   if(R()>ss(.32,.62,c)||OC[oci(x,z)]||inSet(x,SV[o+1],z))continue;
   inst(x,SV[o+1]-(SV[o+3]*dx+SV[o+5]*dz)/SV[o+4]-.04,z,RR(.7,1.9)*(.55+.45*ss(.35,.7,c)),R()*TAU,R()*TAU,R(),0)}
  for(let i=0;i<4000;i++){const o=top(B0,B1,.7);if(o>=0)on(o,0,.03,RR(.6,1.3),R()*TAU)}});
 // loose rocks: pebbles scattered over the floor, larger stones in clusters at the foot of the walls, a few on the ledges
 for(let k=0;k<2;k++)grp('rock'+k,()=>{
  for(let i=0;i<7600;i+=THIN){const o=pick(.55,2,-60,-3,i%2?near:0,0,TVN);if(o<0)continue;const dx=RR(-.8,.8),dz=RR(-.8,.8),x=SV[o]+dx,z=SV[o+2]+dz,s=R()<.06?RR(.45,1.1):RR(.07,.38);
   if(OC[oci(x,z)]||inSet(x,SV[o+1],z))continue;inst(x,SV[o+1]-(SV[o+3]*dx+SV[o+5]*dz)/SV[o+4]-s*.25,z,s,R()*TAU,0,R(),0)}
  for(let c=0;c<90;c++){const o=wall();if(o<0)continue;const bx=SV[o]+SV[o+3]*2,bz=SV[o+2]+SV[o+5]*2;
   for(let i=0;i<14;i++){const x=bx+RR(-3,3),z=bz+RR(-3,3),y=gy(x,z),s=RR(.2,.9);if(y<-59||y>-4||inSet(x,y,z)||td(x,y+s,z)<.2)continue;inst(x,y-s*.2,z,s,R()*TAU,0,R(),0)}}});
 for(let k=0;k<2;k++)grp('coral'+k,()=>{
  for(let i=0;i<440;i++){const s=RR(.8,2.5),o=flr(.6,-3.5,i,3,s*.35);if(o>=0){on(o,0,0,s,0);occ(SV[o],SV[o+2],s*.3)}}
  for(let i=0;i<350;i++){const o=wall();if(o>=0){const s=RR(.7,1.8);on(o,.1*s,.1*s,s,0)}}
  for(let i=0;i<70;i++){const o=i%2?top(SHP[0],SHP[1],.75):top(FLK[0],FLK[1],.8);if(o>=0)on(o,0,.03,RR(.4,.9),0)}});
 // fish schools near the fly path. Each fish takes one slot of a shuffled 12x5x4 lattice (packed into the phase float), so fish keep their distance.
 grp('fish',()=>{const SL=new Uint8Array(240),J=()=>RR(-.28,.28);
  for(let s=0,g=0;s<15&&g<8000;g++){pathP(RR(0,NK-1.6),_a);const ax=_a[0]+RR(-12,12),ay=_a[1]+RR(-5,6),az=_a[2]+RR(-12,12),ph=R()*TAU,Rx=RR(6,9);
   if(!orbOK(ax,ay,az,ph,Rx,2.5,2,4.5)||flyD(ax,ay,az,ph,Rx,2.5,2,2.2/(Rx*1.5),.65)<5.5||poseD(ax,ay,az,ph,Rx,2.5,2)<8.5)continue;s++;const tint=R(),n=120+floor(R()*110),sz=RR(.24,.42);
   for(let i=0;i<240;i++)SL[i]=i;for(let i=239;i>0;i--){const j=floor(R()*(i+1)),t=SL[i];SL[i]=SL[j];SL[j]=t}
   for(let i=0;i<n;i++){const k=SL[i],q=round((k%12+.5+J())/12*127)+128*round((floor(k/12)%5+.5+J())/5*127)+16384*round((floor(k/60)+.5+J())/4*127);
    inst(ax,ay,az,sz*RR(.75,1.25),ph,q/2097152,(tint+RR(-.05,.05)+1)%1,Rx)}}});
 // mantas: two low over the start area, one over the ship, the rest along the canyon; none meets the scripted camera
 grp('manta',()=>{for(let s=0,g=0;s<9&&g<20000;g++){const f=s<2,sh=s==8,ax=sh?RR(52,68):RR(-9,9),ay=f?RR(-31,-24):sh?RR(-25,-20):RR(-30,-13),az=f?RR(-8,22):sh?RR(-34,-18):RR(-96,34),ph=R()*TAU,Rx=RR(7,12);
  if(!orbOK(ax,ay,az,ph,Rx,2,1.5,3.6)||flyD(ax,ay,az,ph,Rx,2,1.5,1.3/(Rx*1.25),0)<7||poseD(ax,ay,az,ph,Rx,2,1.5)<9)continue;s++;inst(ax,ay,az,RR(2.5,3.4),ph,R(),R(),Rx)}});
 // bubble columns rising from floor vents; they stop under overhangs
 for(let e=0;e<70;e++){const o=pick(.8,2,-60,-30,e%2?corr:0,0,TVN);if(o<0)continue;const x=SV[o],y=SV[o+1],z=SV[o+2],sd=R();let H=-.4-y;
  for(let h=2;h<H;h+=2)if(td(x,y+h,z)<.5&&y+h<-3.4){H=h-1;break}
  for(let i=0;i<40;i++)spr(x,y,z,RR(.015,.05),1,R(),H,sd)}
 // marine snow in a unit cube; the shader wraps it around the camera
 for(let i=0;i<10000;i++)spr(R(),R(),R(),RR(.012,.03),0,R(),R(),R());
}
// camera collision: stamp the ship, the sculpture and the boulders into the density grid. The page calls this after placement is done.
function stampSolid(){const st=(f,cx,cz,r)=>{const i0=max(floor((cx-r-G0)/GH),0),i1=min(floor((cx+r-G0)/GH)+1,GX),k0=max(floor((cz-r-G0)/GH),0),k1=min(floor((cz+r-G0)/GH)+1,GX);
  for(let k=k0;k<=k1;k++)for(let j=0;j<=GY;j++)for(let i=i0;i<=i1;i++){const p=i+j*SX+k*SXY,d=f(G0+i*GH,GB+j*GH,G0+k*GH);if(d<TD[p])TD[p]=d}};
 st(shipW,60,-26,30);st(flukeW,-4,-92,16);
 for(let b=0;b<136;b+=4)st((x,y,z)=>hypot(x-BL[b],y-BL[b+1],z-BL[b+2])-BL[b+3]*.72,BL[b],BL[b+2],BL[b+3]+3)}
// spatial chunks for frustum culling. Instances of each group are sorted into 40 m cells, world triangles too.
// CH = centre x,y,z and radius of each draw. DR = indexCount, instanceCount, firstIndex, firstInstance, castsShadow.
// DR = indexCount, instanceCount, firstIndex, firstInstance, castsShadow, LOD indexCount, LOD firstIndex.
// DF = draw distance and LOD distance of each draw in metres (the page scales both with the detail setting).
let CH_,DR,DF;
const FAR={world:[260,1e9],kelp:[190,34],bush:[90,1e9],tuft:[58,20],rock0:[50,1e9],rock1:[50,1e9],sponge:[130,1e9],mound:[130,1e9],coral0:[130,1e9],coral1:[130,1e9],fish:[150,1e9],manta:[220,1e9]};
function buildChunks(){const key=(x,z,c=40)=>floor((x+200)/c)+floor((z+200)/c)*32,ch=[],dr=[],df=[],B=new Float64Array(6);
 const b0=()=>{B[0]=B[1]=B[2]=1e9;B[3]=B[4]=B[5]=-1e9},bg=(x,y,z,h,lo,hi)=>{B[0]=min(B[0],x-h);B[1]=min(B[1],y+lo);B[2]=min(B[2],z-h);B[3]=max(B[3],x+h);B[4]=max(B[4],y+hi);B[5]=max(B[5],z+h)};
 const emit=(ic,nc,fi,f0,sh,n,L)=>{ch.push((B[0]+B[3])/2,(B[1]+B[4])/2,(B[2]+B[5])/2,hypot(B[3]-B[0],B[4]-B[1],B[5]-B[2])/2);dr.push(ic,nc,fi,f0,sh,L?L[1]:ic,L?L[0]:fi);df.push(...FAR[n])};
 // world: triangles sorted by the cell of their first vertex; the box takes all three vertices
 const nt=M.kelp[0]/3,kt=new Int32Array(nt),ord=new Uint32Array(nt),old=SI.slice(0,nt*3);
 for(let t=0;t<nt;t++){const o=old[t*3]*12;kt[t]=key(SV[o],SV[o+2]);ord[t]=t}
 ord.sort((a,b)=>kt[a]-kt[b]||a-b);
 for(let s=0;s<nt;){let e=s;b0();while(e<nt&&kt[ord[e]]==kt[ord[s]]){for(let k=0;k<3;k++){const v=old[ord[e]*3+k];SI[e*3+k]=v;bg(SV[v*12],SV[v*12+1],SV[v*12+2],0,0,0)}e++}emit((e-s)*3,1,s*3,0,1,'world');s=e}
 // instance groups. Margins (horizontal, below, above) cover the mesh and its animation; a school or a manta is one chunk around its whole orbit.
 const MG={kelp:[6,-1,38],bush:[3,-1.5,3],tuft:[1.5,-.5,1.5],rock0:[1.5,-1,1.5],rock1:[1.5,-1,1.5],sponge:[2.5,-.5,3.5],mound:[2.5,-1,2.5],coral0:[3.5,-1,4],coral1:[3.5,-1,4]};
 for(const[n,i0,c]of DL){if(n=='world')continue;const m=M[n],sw=n=='fish'||n=='manta',cs=n=='tuft'||n[0]=='r'?20:40,kk=new Float64Array(c),od=new Uint32Array(c),src=IB.slice(i0*8,(i0+c)*8);
  for(let i=0;i<c;i++){const o=i*8;kk[i]=n=='manta'?i:n=='fish'?src[o]*1e3+src[o+2]:key(src[o],src[o+2],cs);od[i]=i}
  od.sort((a,b)=>kk[a]-kk[b]||a-b);
  for(let s=0;s<c;){let e=s;b0();while(e<c&&kk[od[e]]==kk[od[s]]){const o=od[e]*8;IB.set(src.subarray(o,o+8),(i0+e)*8);
    if(sw){const h=src[o+7]*2+7;bg(src[o],src[o+1],src[o+2],h,-9,9)}else{const g=MG[n],q=max(src[o+3],1);bg(src[o],src[o+1],src[o+2],g[0]*q,g[1]*q,g[2]*q)}e++}
   emit(m[1],e-s,m[0],i0+s,+(n!='tuft'&&n!='bush'&&n[0]!='r'),n,M[n+'L']);s=e}}
 CH_=new Float32Array(ch);DR=new Int32Array(dr);DF=new Float32Array(df)}
// leaves in the world: kelp fronds, ground-cover fronds and bush leaves
const leaves=()=>{let n=0;for(const[k,,c]of DL)n+=c*(k=='kelp'?230:k=='tuft'?10:k=='bush'?13:0);return n};
