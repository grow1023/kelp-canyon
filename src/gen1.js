// gen1: noise, surface nets, static world (terrain, boulders, ship, fluke). Runs once at init.
const{sin,cos,abs,min,max,floor,sqrt,PI,hypot,atan2,pow,exp,round}=Math,TAU=PI*2;
// Run mode and detail level. LV: 0 High, 1 Medium, 2 Low. THIN keeps every 1st / 2nd / 4th tuft, pebble and sparkle.
// The level comes from ?q=, then from the stored choice, then from the device (touch screen, memory).
const QS=typeof location=='undefined'?'':location.search,TEST=/cap|bench|dbg/.test(QS);
const LS=k=>{try{return localStorage[k]}catch{}},keep=(k,v)=>{try{localStorage[k]=v}catch{}};
const SVD=(TEST?'':LS('kelp')||'').split(','),MOB=typeof matchMedia!='undefined'&&matchMedia('(pointer:coarse)').matches,MEM=typeof navigator!='undefined'&&navigator.deviceMemory||8;
const LV=/[?&]q=([012])/.test(QS)?+RegExp.$1:SVD[0]?+SVD[0]:MOB?(MEM>7?1:2):MEM<=4?2:0,THIN=1<<LV;
const cl=(x,a,b)=>min(max(x,a),b),mix=(a,b,t)=>a+(b-a)*t,ss=(a,b,x)=>{x=cl((x-a)/(b-a),0,1);return x*x*(3-2*x)};
const smin=(a,b,k)=>{const h=max(k-abs(a-b),0)/k;return min(a,b)-h*h*k*.25};
let _s=20261116;
const R=()=>{_s=_s+0x6D2B79F5|0;let t=Math.imul(_s^_s>>>15,1|_s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296},RR=(a,b)=>a+(b-a)*R();
const H3=(x,y,z)=>{let h=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(z,1440662683)|0;h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296};
// value noise in [-.5,.5]; P = optional lattice period (tileable)
const n3=(x,y,z,P)=>{let X=floor(x),Y=floor(y),Z=floor(z),u=x-X,v=y-Y,w=z-Z,X1=X+1,Y1=Y+1,Z1=Z+1;
 if(P){X=(X%P+P)%P;Y=(Y%P+P)%P;Z=(Z%P+P)%P;X1=(X+1)%P;Y1=(Y+1)%P;Z1=(Z+1)%P}
 u=u*u*(3-2*u);v=v*v*(3-2*v);w=w*w*(3-2*w);
 const a=H3(X,Y,Z),b=H3(X1,Y,Z),c=H3(X,Y1,Z),d=H3(X1,Y1,Z),e=H3(X,Y,Z1),f=H3(X1,Y,Z1),g=H3(X,Y1,Z1),h=H3(X1,Y1,Z1);
 return mix(mix(mix(a,b,u),mix(c,d,u),v),mix(mix(e,f,u),mix(g,h,u),v),w)-.5};
const fb=(x,y,z)=>n3(x,y,z)+.5*n3(x*2.03+7,y*2.03,z*2.03)+.25*n3(x*4.1,y*4.1+3,z*4.1);
const n2=(x,z)=>2*n3(x,.5,z);

// static vertex = pos3 normal3 local3 mat ao (11 floats)
let SV=new Float32Array(4.6e5*12),SI=new Uint32Array(3.4e6),nv=0,ni=0;
const quad=(a,b,c,d,f)=>{if(f){const t=b;b=d;d=t}SI[ni++]=a;SI[ni++]=b;SI[ni++]=c;SI[ni++]=a;SI[ni++]=c;SI[ni++]=d};
const CO=[0,0,0,1,0,0,0,1,0,1,1,0,0,0,1,1,0,1,0,1,1,1,1,1],ED=[0,1,2,3,4,5,6,7,0,2,1,3,4,6,5,7,0,4,1,5,2,6,3,7],dd=new Float32Array(8);
// naive surface nets over f (<0 solid). a = AO probe radius. Returns the density grid.
// D0 = density grid that the GPU already filled: then f is not sampled and the caller sets the AO.
function nets(f,ox,oy,oz,nx,ny,nz,h,mat,a,D0){
 const sx=nx+1,sxy=sx*(ny+1),D=D0||new Float32Array(sxy*(nz+1)),C=new Int32Array(sxy*(nz+1)),v0=nv,of=[0,1,sx,sx+1,sxy,sxy+1,sxy+sx,sxy+sx+1];
 if(!D0)for(let k=0,p=0;k<=nz;k++)for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)D[p++]=f(ox+i*h,oy+j*h,oz+k*h);
 for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const p=i+j*sx+k*sxy;let m=0;
  for(let c=0;c<8;c++){dd[c]=D[p+of[c]];if(dd[c]<0)m|=1<<c}
  if(!m||m==255)continue;
  let X=0,Y=0,Z=0,n=0;
  for(let e=0;e<24;e+=2){const A=ED[e],B=ED[e+1];if((m>>A&1)!=(m>>B&1)){const t=dd[A]/(dd[A]-dd[B]);X+=mix(CO[A*3],CO[B*3],t);Y+=mix(CO[A*3+1],CO[B*3+1],t);Z+=mix(CO[A*3+2],CO[B*3+2],t);n++}}
  const gx=dd[1]+dd[3]+dd[5]+dd[7]-dd[0]-dd[2]-dd[4]-dd[6],gy=dd[2]+dd[3]+dd[6]+dd[7]-dd[0]-dd[1]-dd[4]-dd[5],gz=dd[4]+dd[5]+dd[6]+dd[7]-dd[0]-dd[1]-dd[2]-dd[3],gl=1/(hypot(gx,gy,gz)||1),o=nv*12;
  C[p]=nv++;
  SV[o]=SV[o+6]=ox+(i+X/n)*h;SV[o+1]=SV[o+7]=oy+(j+Y/n)*h;SV[o+2]=SV[o+8]=oz+(k+Z/n)*h;SV[o+3]=gx*gl;SV[o+4]=gy*gl;SV[o+5]=gz*gl;SV[o+9]=mat;
  const s=dd[0]<0;
  if(j&&k&&s!=(dd[1]<0))quad(C[p],C[p-sx],C[p-sx-sxy],C[p-sxy],!s);
  if(i&&k&&s!=(dd[2]<0))quad(C[p],C[p-1],C[p-1-sxy],C[p-sxy],s);
  if(i&&j&&s!=(dd[4]<0))quad(C[p],C[p-1],C[p-1-sx],C[p-sx],!s);
 }
 if(a)for(let i=v0;i<nv;i++){const o=i*12,x=SV[o],y=SV[o+1],z=SV[o+2],A=SV[o+3],B=SV[o+4],c=SV[o+5];
  SV[o+10]=cl(.2+.4*f(x+A*a,y+B*a,z+c*a)/a+.4*f(x+A*a*3.5,y+B*a*3.5,z+c*a*3.5)/(a*3.5),0,1)}
 return D}
// place verts [v0,nv): scale, tilt about x, yaw about y, translate. local attr is left untouched.
function xf(v0,px,py,pz,s,yaw,tilt){const cy=cos(yaw),sy=sin(yaw),ct=cos(tilt),st=sin(tilt);
 for(let i=v0;i<nv;i++)for(let q=0;q<6;q+=3){const o=i*12+q,k=q?1:s,x=SV[o]*k,y=SV[o+1]*k,z=SV[o+2]*k,y1=y*ct-z*st,z1=y*st+z*ct;
  SV[o]=x*cy+z1*sy+(q?0:px);SV[o+1]=y1+(q?0:py);SV[o+2]=z1*cy-x*sy+(q?0:pz)}}

// ---- terrain: valley floor, canyon walls along a corridor (x=0, z -100..40), noise canyons beyond, rim, two arches
const AX=[0,-50,-36,22,5.2,0,30,-50,-26,21,4.6,1.5708];
const T=(x,y,z)=>{const r=hypot(x,z),ds=hypot(x,z-cl(z,-100,40));
 let h=-46+5*n2(x*.017,z*.017)+1.6*n2(x*.06+9,z*.06);
 const wn=ss(.1,.34,abs(n2(x*.0105+3.1,z*.0105-1.7)+.35*n2(x*.027,z*.027+5)));
 // walls: corridor sides, noise canyons beyond, the ship basin with an uneven edge; passes cut through the rock away from the corridor
 const w=mix(ss(27,45,ds+7*n2(x*.03+2,z*.03)),wn,ss(46,90,ds))*ss(40,57,hypot(x-60,z+26)+6*n2(x*.045+1,z*.045+6))*mix(1,ss(.1,.3,abs(n2(x*.023+9,z*.023+3))),ss(34,52,ds));
 // the rim height changes a lot from place to place, so no crest runs straight
 h+=w*(27+22*n2(x*.031+4,z*.031-2)+9*n2(x*.09,z*.09+2))+50*ss(118,170,r);h=smin(h,-9.5+4.5*n2(x*.035,z*.035+7)+1.5*n2(x*.11,z*.11),6);
 let d=y-h;
 if(abs(d)<18){const s=4*w*(1-w)+.5*ss(118,150,r);
  // lumps, terraces (a ledge every 6 m that steps back and juts out again), vertical buttresses
  d+=fb(x*.05,y*.08,z*.05)*13*s+fb(x*.17,y*.17,z*.17)*2.4*(.35+s)+((q=>(q-=floor(q),q<.8?q/.8:(1-q)/.2))(y*.17+1.6*n2(x*.02,z*.02))-.5)*3.4*s+(abs(n2(x*.075+3,z*.075))-.35)*8*s}
 for(let i=0;i<12;i+=6){const c=cos(AX[i+5]),s=sin(AX[i+5]),lx=(x-AX[i])*c+(z-AX[i+2])*s,lz=(z-AX[i+2])*c-(x-AX[i])*s,q=hypot(lx,y-AX[i+1])-AX[i+3];
  if(abs(q)<12&&abs(lz)<12)d=smin(d,hypot(q,lz*.75)-AX[i+4]+fb(x*.11,y*.11,z*.11)*3.2+fb(x*.36,y*.36,z*.36)*1.3,4)}
 return max(d,y+3.2)};
const GX=230,GY=37,GH=1.6,G0=-184,GB=-62,SX=GX+1,SXY=SX*(GY+1);
let TD;
// top-most ground height at (x,z) from the density grid
const gy=(x,z)=>{const p=cl(round((x-G0)/GH),0,GX)+cl(round((z-G0)/GH),0,GX)*SXY;
 for(let j=0;j<GY;j++){const a=TD[p+j*SX],b=TD[p+(j+1)*SX];if(a<0&&b>=0)return GB+(j+a/(a-b))*GH}return GB};
// trilinear density at a point (camera collision; allocation-free)
const td=(x,y,z)=>{x=(x-G0)/GH;y=(y-GB)/GH;z=(z-G0)/GH;const i=cl(floor(x),0,GX-1),j=cl(floor(y),0,GY-1),k=cl(floor(z),0,GX-1),u=cl(x-i,0,1),v=cl(y-j,0,1),w=cl(z-k,0,1),p=i+j*SX+k*SXY;
 return mix(mix(mix(TD[p],TD[p+1],u),mix(TD[p+SX],TD[p+SX+1],u),v),mix(mix(TD[p+SXY],TD[p+SXY+1],u),mix(TD[p+SXY+SX],TD[p+SXY+SX+1],u),v),w)};

// ---- ship hull (local: x along keel, y up, z beam): planking shell with missing patches, frames, keel, deck beams, broken mast
const cap=(x,y,z,ax,ay,az,bx,by,bz,r)=>{const dx=bx-ax,dy=by-ay,dz=bz-az,t=cl(((x-ax)*dx+(y-ay)*dy+(z-az)*dz)/(dx*dx+dy*dy+dz*dz),0,1);return hypot(x-ax-dx*t,y-ay-dy*t,z-az-dz*t)-r};
const ship=(x,y,z)=>{const t=x/23,b=6.2*pow(max(1-pow(abs(t),2.6),0),.6),yy=cl(y/8.5,0,1.5),sh=6.8+4.6*t*t+(t>.5?1.3:0)+(t<-.62?3:0),o=max(abs(z)-b*pow(yy,.45),-y)*.8;
 const pk=floor(y*1.9),hb=fb(x*.1+4+H3(pk,3,1)*.13,pk*.074,z*.1)-.16; // breaches follow the planks: each plank breaks off at its own place
 let d=max(o,-o-.42,y-sh,hb*8);
 d=min(d,max(abs((x+54)%1.8-.9)-.16,o,-o-.95,y-sh-.4-1.1*H3(floor((x+54)/1.8),5,2)),max(abs(z)-.3,abs(y+.2)-.6,abs(x)-23.5)); // ribs stand above the rail; keel
 d=min(d,max(abs(z)-.3,abs(x+22.9)-.7,y-9.6,-y)); // sternpost, joined to the hull end
 d=min(d,max(abs(y-6.5)-.16,o,-max(abs(x-5)-3.4-fb(x*.6,1,z*.6)*1.1,abs(z)-2.1-fb(x*.6+9,2,z*.6)*.9),(fb(x*.21,3,z*.21)-.16)*6),max(abs(y-9.4)-.16,o,x+14.3)); // deck with hatch, quarterdeck
 // masts taper and end in splintered breaks; the fore mast keeps its top platform and two yards
 const jag=fb(x*2.2,y*.7,z*2.2)*2.4;
 d=min(d,max(hypot(x-12,z)-.54+y*.018,y-18.2-jag,2-y),max(hypot(x-12,z)-1.3,abs(y-14.7)-.12),cap(x,y,z,12,14.1,-5.5,12,13.5,5.5,.26),cap(x,y,z,12,17.3,-3.4,12,17.6,3.4,.25));
 d=min(d,max(hypot(x+1-(y-6)*.1,z)-.6+y*.014,y-12.4-jag,2-y),max(hypot(x+13,z)-.48+y*.016,y-16.4-jag,2-y),cap(x,y,z,-13,13.6,-4.2,-13,13,4.2,.25));
 return min(d,cap(x,y,z,-7,7.4,-6.5,8,10,5,.3),cap(x,y,z,21.5,8.6,0,30.5,11.6,0,.27))}; // fallen spar, bowsprit
// ---- whale fluke sculpture (local: y up, flukes spread along x) on a stepped plinth
const FK=[0,9.3,1.5,2.3,11.5,1.9,4.9,13.1,1.7,7.3,13.5,1.15,9,12.6,.6,9.9,11.2,.3];
const sg=(px,py,ax,ay,ra,bx,by,rb)=>{const dx=bx-ax,dy=by-ay,t=cl(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy),0,1);return[hypot(px-ax-dx*t,py-ay-dy*t)-mix(ra,rb,t),mix(ra,rb,t)]};
const fluke=(x,y,z)=>{const X=abs(x),zz=z+.03*x*x-.012*y*y,rs=mix(2.7,.95,cl((y+2)/11.5,0,1)),rq=hypot(x,zz*1.35);
 let d=max(rq-rs*(1+.05*cos(atan2(zz,x)*7)),y-10,-2.6-y); // fluted stem
 d=min(d,max(hypot(rq-rs,((y+1.2)%3.3+3.3)%3.3-1.65)-.27,y-8.5,-1-y)); // three carved rings
 for(let i=0;i<15;i+=3){const[q,r]=sg(X,y,FK[i],FK[i+1],FK[i+2],FK[i+3],FK[i+4],FK[i+5]);d=smin(d,max(q,abs(zz)-.26-.3*r),.7)}
 d+=max(fb(x*.55+3,y*.55,z*.55)-.12,0)*.9; // chips and erosion
 const rr=hypot(x,z);
 return min(d,max(rr-7+fb(x*.4,1,z*.4)*.6,abs(y+1.9)-.7),max(rr-5.4,abs(y+.8)-.5))};

const inv=(f,px,py,pz,s,yaw,tilt)=>{const cy=cos(yaw),sy=sin(yaw),ct=cos(tilt),st=sin(tilt);return(X,Y,Z)=>{const dx=(X-px)/s,dy=(Y-py)/s,dz=(Z-pz)/s,z1=dx*sy+dz*cy;return f(dx*cy-dz*sy,dy*ct+z1*st,z1*ct-dy*st)*s}};
let shipW,flukeW;
// BL = boulder spheres (x,y,z,r) for shadows; cov = magenta ground-cover mask shared by shader + tuft placement
const BL=new Float32Array(136),PL=new Float32Array(28),cov=(x,z)=>ss(0,.3,n2(x*.045+5,z*.045)+.5*n2(x*.13,z*.13+2));
let TVN=0,SHP=[0,0],FLK=[0,0],SHY=0,FLY=0;
// The world is built in stages, so the page can draw a loading bar between them. D0 = terrain density from the GPU (optional).
function bs0(D0){
 TD=nets(T,G0,GB,G0,GX,GY,GX,GH,0,0,D0);TVN=nv;
 // terrain AO: open-water fraction of a hemisphere, sampled from the density grid at 3 radii
 for(let i=0;i<nv;i++){const o=i*12,A=SV[o+3],B=SV[o+4],C=SV[o+5],x=SV[o]+A*.9,y=SV[o+1]+B*.9,z=SV[o+2]+C*.9;let a=0;
  for(let k=0;k<14;k++){const yk=1-(k+.5)/7,r=sqrt(1-yk*yk),t=k*2.4;let dx=cos(t)*r,dy=yk,dz=sin(t)*r;const dn=dx*A+dy*B+dz*C;
   if(dn<0){dx-=2*dn*A;dy-=2*dn*B;dz-=2*dn*C}
   for(let q=2.5;q<20;q*=2.6)a+=ss(-.8,.8,td(x+dx*q,y+dy*q,z+dz*q))}
  SV[o+10]=pow(a/42,1.25);SV[o+9]=.85*cov(SV[o],SV[o+2])*ss(.6,.85,B)}}
function bs1(){
 for(let i=0;i<34;i++){const sd=i*9.1,v0=nv,fl=i<26;
  for(let k=0;k<28;k+=4){const a=RR(0,TAU),yv=RR(-1,1),r=sqrt(1-yv*yv);PL[k]=cos(a)*r;PL[k+1]=yv;PL[k+2]=sin(a)*r;PL[k+3]=RR(.6,.92)}
  nets((x,y,z)=>{let d=hypot(x,y*1.2,z)-1.08+fb(x*1.1+sd,y*1.1,z*1.1)*.55;for(let k=0;k<28;k+=4)d=max(d,x*PL[k]+y*PL[k+1]+z*PL[k+2]-PL[k+3]);return d+fb(x*3+sd,y*3,z*3)*.15},-1.7,-1.7,-1.7,34,34,34,.1,5,.25);
  let x,y,z,s,g=0; // keep boulders off the scripted fly path
  do{const a=RR(0,TAU),r=fl?RR(8,60):RR(10,34);x=sin(a)*r*(fl?1:.7);z=cos(a)*r-(fl?34:30);s=fl?RR(1.2,4.6):RR(1.5,3.2);y=fl?RR(-36,-13):gy(x,z)+s*.25}while(pathD(x,y,z)<s*1.9+3&&++g<50);
  BL[i*4]=x;BL[i*4+1]=y;BL[i*4+2]=z;BL[i*4+3]=s*1.25;
  xf(v0,x,y,z,s,RR(0,TAU),RR(-.6,.6))}}
function bs2(){
 SHP=[nv,0];nets(ship,-25.5,-1.2,-7.5,228,84,60,.25,1,.5);SHY=gy(60,-26)-1.5;xf(SHP[0],60,SHY,-26,.8,.95,.3);SHP[1]=nv;shipW=inv(ship,60,SHY,-26,.8,.95,.3)}
function bs3(){
 FLK=[nv,0];nets(fluke,-11.2,-2.8,-7.6,102,86,70,.22,2,.4);FLY=gy(-4,-92)+1.6;xf(FLK[0],-4,FLY,-92,1,.95,-.12);FLK[1]=nv;flukeW=inv(fluke,-4,FLY,-92,1,.95,-.12);
 for(let i=0;i<30;i+=5)POSES[i+1]=max(POSES[i+1],gy(POSES[i],POSES[i+2])+1.8);
}
const buildStatic=D0=>{bs0(D0);bs1();bs2();bs3()};
