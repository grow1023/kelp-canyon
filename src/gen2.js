// gen2: scripted fly path + prop meshes. Props share the static vertex buffer; M[name]=[firstIndex,indexCount].
const PK=[0,-33,36,2,-36,14,-3,-38,-10,0,-38,-30,4,-34,-52,-13,-33,-73,-21,-30,-95,-3,-26,-111,16,-27,-88,10,-31,-62,3,-38,-42,14,-39,-23,30,-39,-26,42,-37,-34,56,-35,-48,74,-33,-60,90,-31,-48,92,-30,-28,80,-29,-10,62,-29,-2,46,-27,8,30,-22,10,12,-16,8,0,-20,26],NK=PK.length/3;
// Catmull-Rom position at key coordinate u in [0,NK-1], written into o (allocation-free)
// pathQ reads the key coordinate from PU[0] (+0.5 when h=1). Frame code passes doubles through typed arrays only:
// a double argument or return value is boxed on the heap whenever the JIT does not inline the callee.
const PU=new Float64Array(1),pathP=(u,o)=>{PU[0]=u;pathQ(o,0)};
const pathQ=(o,h)=>{let u=PU[0]+h*.5;u=u<0?0:u>NK-1.001?NK-1.001:u;const i=floor(u),f=u-i,a=(i>0?i-1:0)*3,b=i*3,c=(i<NK-1?i+1:NK-1)*3,d=(i<NK-2?i+2:NK-1)*3,f2=f*f,f3=f2*f;
 for(let k=0;k<3;k++)o[k]=.5*(2*PK[b+k]+(PK[c+k]-PK[a+k])*f+(2*PK[a+k]-5*PK[b+k]+4*PK[c+k]-PK[d+k])*f2+(3*PK[b+k]-PK[a+k]-3*PK[c+k]+PK[d+k])*f3)};
const _p=new Float32Array(3);
// distance from a point to the fly path; flat=1 ignores height (for tall columns)
let PS;function pathD(x,y,z,flat){if(!PS){PS=new Float32Array((floor((NK-1)/.05)+1)*3);for(let i=0;i<PS.length;i+=3){pathP(i/60,_p);PS.set(_p,i)}}
 let m=1e9;for(let i=0;i<PS.length;i+=3){const dx=x-PS[i],dy=flat?0:y-PS[i+1],dz=z-PS[i+2],d=dx*dx+dy*dy+dz*dz;if(d<m)m=d}return sqrt(m)}

// fixed camera poses (x,y,z,yaw,pitch): start, surface, arch, fluke, ship, ground cover
const POSES=[0,-33,36,0,.12, 2,-41,12,2.19,.9, -4,-40,-12,.1,.22, 11.4,-37,-81,-.95,.12, 78,-38,-13,-.945,.04, 5,-43.5,24,-.7,-.2];
const M={},_a=[0,0,0],_b=[0,0,0],_c=[0,0,0];
const V=(x,y,z,a,b,c,u,v,w,m,ao,e)=>{const o=nv*12;SV[o]=x;SV[o+1]=y;SV[o+2]=z;SV[o+3]=a;SV[o+4]=b;SV[o+5]=c;SV[o+6]=u;SV[o+7]=v;SV[o+8]=w;SV[o+9]=m;SV[o+10]=ao;SV[o+11]=e||0;return nv++};
// closed-ish parametric surface f(u,v,out); numeric normals, auto-oriented outward; local=(u,v,w)
function psurf(f,nu,nw,mat,w){const v0=nv,e=.004;let cx=0,cy=0,cz=0,sg=0;
 for(let j=0;j<=nw;j++)for(let i=0;i<=nu;i++){const u=i/nu,v=j/nw,vd=cl(v,.006,.99);f(u,v,_a);const px=_a[0],py=_a[1],pz=_a[2];
  f(u,vd,_a);f(u+e,vd,_b);f(u,vd+e,_c);
  const ax=_b[0]-_a[0],ay=_b[1]-_a[1],az=_b[2]-_a[2],bx=_c[0]-_a[0],by=_c[1]-_a[1],bz=_c[2]-_a[2],x=ay*bz-az*by,y=az*bx-ax*bz,z=ax*by-ay*bx,l=1/(hypot(x,y,z)||1);
  V(px,py,pz,x*l,y*l,z*l,u,v,w,mat,1);cx+=px;cy+=py;cz+=pz}
 const n=nv-v0;cx/=n;cy/=n;cz/=n;
 for(let i=v0;i<nv;i++){const o=i*12;sg+=SV[o+3]*(SV[o]-cx)+SV[o+4]*(SV[o+1]-cy)+SV[o+5]*(SV[o+2]-cz)}
 if(sg<0)for(let i=v0;i<nv;i++){const o=i*12;SV[o+3]*=-1;SV[o+4]*=-1;SV[o+5]*=-1}
 for(let j=0;j<nw;j++)for(let i=0;i<nu;i++){const p=v0+i+j*(nu+1);quad(p,p+1,p+nu+2,p+nu+1)}}
// thin ribbon along curve g(s,out), fixed side vector, half-width wf(s); local=(s,l1,l2), extra=side(-1|1)
function rib(g,n,sx,sy,sz,wf,mat,l1,l2,cv){const v0=nv;cv=cv||0; // cv tilts the two edge normals apart: a flat ribbon then shades like a curved leaf
 for(let i=0;i<=n;i++){const s=i/n;g(s+.01,_b);g(s,_a);const tx=_b[0]-_a[0],ty=_b[1]-_a[1],tz=_b[2]-_a[2],x=ty*sz-tz*sy,y=tz*sx-tx*sz,z=tx*sy-ty*sx,l=1/(hypot(x,y,z)||1),w=wf(s);
  for(let k=-1;k<2;k+=2){const ax=x*l+sx*k*cv,ay=y*l+sy*k*cv,az=z*l+sz*k*cv,al=1/hypot(ax,ay,az);V(_a[0]+sx*w*k,_a[1]+sy*w*k,_a[2]+sz*w*k,ax*al,ay*al,az*al,s,l1,l2,mat,1,k)}}
 for(let i=0;i<n;i++){const p=v0+i*2;quad(p,p+1,p+3,p+2)}}
// 5-sided tapered tube a->b; local.x runs t0..t1
function tube(a,b,ra,rb,t0,t1,mat){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],L=hypot(dx,dy,dz),ex=abs(dy)>.9*L?1:0,ey=1-ex;
 let ux=dy*0-dz*ey,uy=dz*ex-dx*0,uz=dx*ey-dy*ex;const ul=1/hypot(ux,uy,uz);ux*=ul;uy*=ul;uz*=ul;
 const wx=(dy*uz-dz*uy)/L,wy=(dz*ux-dx*uz)/L,wz=(dx*uy-dy*ux)/L,v0=nv;
 for(let j=0;j<2;j++)for(let i=0;i<6;i++){const t=i/5*TAU,c=cos(t),s=sin(t),nx=ux*c+wx*s,ny=uy*c+wy*s,nz=uz*c+wz*s,r=j?rb:ra,p=j?b:a;V(p[0]+nx*r,p[1]+ny*r,p[2]+nz*r,nx,ny,nz,j?t1:t0,i/5,0,mat,1)}
 for(let i=0;i<5;i++)quad(v0+i,v0+i+1,v0+i+7,v0+i+6)}
const mesh=(name,f)=>{const i0=ni;f();M[name]=[i0,ni-i0]};

function buildProps(){
 // kelp column, 30 m tall before instance scale: wavy stipe (3 crossed ribbons) + 150 fronds streaming upward
 mesh('kelp',()=>{const H=30,sx=h=>sin(h*.3)*.25,sz=h=>cos(h*.233)*.25;
  for(let k=0;k<2;k++)rib((s,o)=>{o[0]=sx(s*H);o[1]=s*H;o[2]=sz(s*H)},48,cos(k*PI/2),0,sin(k*PI/2),s=>.07*(1.25-s),10,-1,0);
  for(let i=0;i<230;i++){const h=H*(.015+.985*(i+R())/230),a=i*2.4+R(),L=RR(1.1,2.1)*(1-.3*h/H),ox=sin(a),oz=cos(a),tw=RR(-.9,.9),ph=R()*TAU,dr=RR(.15,.75),wv=RR(.5,1.4),out=.55+.3*dr;
   rib((s,o)=>{const q=L*s,lat=sin(s*5*wv+ph)*.12*q;o[0]=sx(h)+ox*q*out+oz*lat;o[1]=h+q*(.75-.5*dr*s);o[2]=sz(h)+oz*q*out-ox*lat},5,oz*cos(tw),sin(tw),-ox*cos(tw),s=>.17*pow(sin(PI*(.06+.94*s)),.55)*(1-.3*s),10,h/H,ph)}});
 // far kelp (level of detail): the same column with 64 wider fronds and a coarse stipe, about a fifth of the triangles
 mesh('kelpL',()=>{const H=30,sx=h=>sin(h*.3)*.25,sz=h=>cos(h*.233)*.25;
  for(let k=0;k<2;k++)rib((s,o)=>{o[0]=sx(s*H);o[1]=s*H;o[2]=sz(s*H)},16,cos(k*PI/2),0,sin(k*PI/2),s=>.09*(1.25-s),10,-1,0);
  for(let i=0;i<64;i++){const h=H*(.015+.985*(i+R())/64),a=i*2.4+R(),L=RR(1.3,2.3)*(1-.3*h/H),ox=sin(a),oz=cos(a),tw=RR(-.9,.9),ph=R()*TAU,dr=RR(.15,.75),out=.55+.3*dr;
   rib((s,o)=>{const q=L*s;o[0]=sx(h)+ox*q*out;o[1]=h+q*(.75-.5*dr*s);o[2]=sz(h)+oz*q*out},3,oz*cos(tw),sin(tw),-ox*cos(tw),s=>.33*pow(sin(PI*(.06+.94*s)),.55)*(1-.3*s),10,h/H,ph)}});
 // loose rocks and pebbles, two shapes: a lumpy ball cut by random planes (same recipe as the boulders, coarse grid)
 for(let k=0;k<2;k++)mesh('rock'+k,()=>{const sd=k*5.3+1;for(let q=0;q<20;q+=4){const a=RR(0,TAU),yv=RR(-1,1),r=sqrt(1-yv*yv);PL[q]=cos(a)*r;PL[q+1]=yv;PL[q+2]=sin(a)*r;PL[q+3]=RR(.55,.9)}
  nets((x,y,z)=>{let d=hypot(x,y*1.35,z)-1+fb(x*1.2+sd,y*1.2,z*1.2)*.6;for(let q=0;q<20;q+=4)d=max(d,x*PL[q]+y*PL[q+1]+z*PL[q+2]-PL[q+3]);return d},-1.36,-1.36,-1.36,8,8,8,.34,5,.3)});
 // iridescent bush: 13 broad arcing leaves
 mesh('bush',()=>{for(let i=0;i<13;i++){const a=i*2.4+R(),L=RR(.8,1.35),p0=RR(.12,.7),b=RR(.7,1.5),ox=sin(a),oz=cos(a),ph=R()*TAU;
  rib((s,o)=>{const q=L*(cos(p0)-cos(p0+b*s))/b;o[0]=ox*q;o[1]=L*(sin(p0+b*s)-sin(p0))/b;o[2]=oz*q},6,oz,0,-ox,s=>.02+.27*pow(sin(PI*pow(s,.8)),.8),11,i/13,ph,.9)}});
 // ground-cover tuft: 10 slim round-tipped fronds that curl outward from spread-out roots
 mesh('tuft',()=>{for(let i=0;i<10;i++){const a=i*2.4+R(),L=RR(.2,.5),ox=sin(a),oz=cos(a),lean=RR(.25,.9),ph=R()*TAU,r=RR(0,.3),bx=ox*r,bz=oz*r;
  rib((s,o)=>{o[0]=bx+ox*L*lean*s*s;o[1]=L*s*(1-.3*lean*s);o[2]=bz+oz*L*lean*s*s},3,oz,0,-ox,s=>.052*sin(PI*min(.1+.9*s,1)),12,i/10,ph,.8)}});
 // far ground cover (level of detail): 4 wider fronds
 mesh('tuftL',()=>{for(let i=0;i<4;i++){const a=i*1.6+R(),L=RR(.25,.5),ox=sin(a),oz=cos(a),lean=RR(.3,.9),ph=R()*TAU;
  rib((s,o)=>{o[0]=ox*(.1+L*lean*s*s);o[1]=L*s*(1-.3*lean*s);o[2]=oz*(.1+L*lean*s*s)},2,oz,0,-ox,s=>.1*sin(PI*min(.1+.9*s,1)),12,i/4,ph,.8)}});
 // barrel sponge: lumpy ribbed lathe with an uneven rim and a hollow top
 mesh('sponge',()=>psurf((u,v,o)=>{const t=u*TAU,k=v<.72,lump=1+.07*sin(t*3+v*8)+.05*sin(t*7-v*13),rim=1+.08*sin(t*2+1)+.05*sin(t*5);let y,r;
  if(k){const q=v/.72;y=q*rim;r=.2+.3*sin(PI*(q*.78+.12))}else{const q=(v-.72)/.28;y=(1-.78*q)*mix(rim,1,q);r=(.2+.3*sin(PI*.9))*(.86-.5*q)}
  r*=lump*(1+(k?.08:.03)*sin(t*11));o[0]=cos(t)*r;o[1]=y;o[2]=sin(t)*r},22,14,13,0));
 // mound (brain) coral
 mesh('mound',()=>psurf((u,v,o)=>{const t=u*TAU,p=v*PI*.5,x=sin(p)*cos(t),y=cos(p),z=sin(p)*sin(t),r=1+.22*fb(x*1.7+3,y*1.7,z*1.7);o[0]=x*r;o[1]=y*r*.72;o[2]=z*r},20,9,15,0));
 // branching coral, two variants
 for(let k=0;k<2;k++)mesh('coral'+k,()=>{const br=(p,d,len,r,dep)=>{const q=[p[0]+d[0]*len,p[1]+d[1]*len,p[2]+d[2]*len];tube(p,q,r,r*.7,dep/5,(dep+1)/5,14);
   if(dep<4)for(let j=0,n=dep?2+(R()>.45):4;j<n;j++){const e=[d[0]+RR(-.85,.85),d[1]+RR(-.1,.55),d[2]+RR(-.85,.85)],l=1/hypot(e[0],e[1],e[2]);br(q,[e[0]*l,e[1]*l,e[2]*l],len*.76,r*.7,dep+1)}};
  br([0,-.1,0],[0,1,0],.42,.085,0)});
 // fish, nose at +z: lathe body with a forked tail, plus dorsal, anal and two pectoral fins (local.z=1 marks a fin)
 mesh('fish',()=>{const RY=(v,top)=>.02+.17*pow(sin(PI*pow(v/.78,.7)),.75)*(1+.25*top*exp(-pow((v-.3)/.13,2)));
  psurf((u,v,o)=>{const t=u*TAU,b=v<.78,s=sin(t),ry=b?RY(v,max(s,0)):mix(.02,.2,ss(.8,1,v)),rx=b?ry*.42:.012;
   o[0]=rx*cos(t);o[1]=ry*s;o[2]=.5-v+(b?0:.11*ss(.84,1,v)*(1-abs(s)))},10,16,20,0);
  const fin=(v0,v1,h,sg)=>rib((s,o)=>{const v=mix(v0,v1,s),w=h*pow(max(sin(PI*pow(s,.6)),0),.8)/2;o[0]=0;o[1]=sg*(RY(v,sg>0?1:0)-.012+w);o[2]=.5-v},4,0,1,0,s=>.004+h*pow(sin(PI*pow(s,.6)),.8)/2,20,0,1);
  fin(.2,.56,.11,1);fin(.46,.64,.06,-1);
  for(let k=-1;k<2;k+=2)rib((s,o)=>{o[0]=k*(.055+.15*s);o[1]=-.035-.05*s;o[2]=.27-.17*s},3,0,.8,.6,s=>.006+.04*sin(PI*pow(s,.7)),20,0,1)});
 // manta, nose at +z: swept wing from span stations (v) and a section loop (u); two cephalic lobes; pointed tips
 mesh('manta',()=>{psurf((u,v,o)=>{const x=v*2-1,a=abs(x),t=u*TAU,zl=.42-.2*a-.5*a*a+.24*exp(-pow((a-.13)/.045,2)),zt=-.5+.22*pow(a,1.5),th=.05*pow(1-a,.8)+.13*exp(-a*a*12);
   o[0]=x;o[2]=(zl+zt)/2+cos(t)*(zl-zt)/2;o[1]=sin(t)*th*(sin(t)<0?.6:1)},16,44,21,0);
  for(let i=0;i<5;i++)tube([0,.02,-.45-i*.25],[0,.02,-.7-i*.25],.024-i*.004,.02-i*.004,0,.4,21)}); // tail in 5 segments so it can bend
}
