// b.wgsl: water optics (shadow, caustics, fog) and the surface material shader
@group(0)@binding(1)var sh:texture_depth_2d;
@group(0)@binding(2)var cs:sampler_comparison;
@group(0)@binding(3)var ct:texture_2d<f32>;
@group(0)@binding(4)var ls:sampler;
const SUNC=vec3f(1.,.93,.78);
fn shadow(wp:vec3f)->f32{let s=u.svp*vec4f(wp,1.);return textureSampleCompareLevel(sh,cs,s.xy*vec2f(.5,-.5)+.5,s.z-.0016);}
fn shadow4(wp:vec3f,n:vec3f)->f32{let s=u.svp*vec4f(wp+n*.12,1.);let uv=s.xy*vec2f(.5,-.5)+.5;let z=s.z-.0009;let e=1.5/4096.;
 return .25*(textureSampleCompareLevel(sh,cs,uv+vec2f(e,e*.4),z)+textureSampleCompareLevel(sh,cs,uv+vec2f(-e*.4,e),z)
  +textureSampleCompareLevel(sh,cs,uv+vec2f(-e,-e*.4),z)+textureSampleCompareLevel(sh,cs,uv+vec2f(e*.4,-e),z));}
// caustic coordinates: world position slid along the sun direction onto the y=0 plane
fn cuv(wp:vec3f)->vec2f{return wp.xz-u.sun.xz/u.sun.y*wp.y;}
// two rotated lookups of the tileable map hide the repeat; k fades contrast when the footprint gets large
fn caus(p:vec2f,k:f32)->f32{let t=u.cam.w;
 let a=textureSampleLevel(ct,ls,p*.043+vec2f(t*.004,0.),0.).r;
 let b=textureSampleLevel(ct,ls,vec2f(p.x*.8+p.y*.6,p.y*.8-p.x*.6)*.027+vec2f(.37,t*.003),0.).r;
 return mix(.42,.3*(a+b)+2.4*a*b,k);}
// sunlight loses red slowly here, so near objects keep their own hue; the fog supplies the blue with distance
fn sunAt(y:f32)->vec3f{return SUNC*2.7*exp(min(y,0.)*vec3f(.013,.008,.008));}
// ambient: sky light from above, bounce from the sand below, and a side term toward the sun azimuth that shapes vertical faces
fn amb(n:vec3f,y:f32)->vec3f{let k=n.y*.5+.5;
 return mix(vec3f(.085,.16,.20),vec3f(.13,.33,.43),k*sqrt(k))*(1.+.6*dot(n.xz,normalize(u.sun.xz)))*exp(min(y,0.)*.012)*1.4;}
// in-scatter colour: cyan near the camera and toward the surface, deep blue with distance and depth
fn fogc(rd:vec3f,d:f32)->vec3f{
 var c=mix(vec3f(.014,.17,.40),vec3f(.003,.03,.19),ss(4.,55.,d));
 c=mix(c,vec3f(.06,.46,.62),ss(0.,.85,rd.y)*.9);
 c*=mix(.35,1.,ss(-1.,.25,rd.y));
 c+=vec3f(.08,.34,.40)*pow(max(dot(rd,u.sun.xyz),0.),5.)*.45;
 return c*exp(u.cam.y*.011);}
fn fog(col:vec3f,wp:vec3f)->vec3f{let v=wp-u.cam.xyz;let d=length(v);
 return col*exp(-d*vec3f(.05,.026,.016))+fogc(v/d,d)*(1.-exp(-d*.028));}
fn pal(t:f32,a:vec3f,b:vec3f,c:vec3f)->vec3f{let k=fract(t)*3.;if(k<1.){return mix(a,b,k);}if(k<2.){return mix(b,c,k-1.);}return mix(c,a,k-2.);}
// 2x2x2 Voronoi: xyz = random vector of the nearest cell, w = distance to the cell border (0 on the border)
fn cell(p:vec3f)->vec4f{let b=vec3i(floor(p-.5));let f=p-vec3f(b);var d1=9.;var d2=9.;var id=0u;
 for(var k=0;k<8;k++){let g=vec3i(k&1,(k>>1u)&1,k>>2u);let c=b+g;let h=hu((u32(c.x)*73856093u)^(u32(c.y)*19349663u)^(u32(c.z)*83492791u));
  let r=vec3f(g)+.25+.5*vec3f(f32(h&1023u),f32((h>>10u)&1023u),f32((h>>20u)&1023u))/1023.-f;let d=dot(r,r);
  if(d<d1){d2=d1;d1=d;id=h;}else if(d<d2){d2=d;}}
 return vec4f(vec3f(f32(id&1023u),f32((id>>10u)&1023u),f32((id>>20u)&1023u))/1023.,sqrt(d2)-sqrt(d1));}

@fragment fn fsM(i:VO,@builtin(front_facing)ff:bool)->@location(0)vec4f{
 let cp=cuv(i.wp);let cf=fwidth(cp.x)+fwidth(cp.y);let dq=fwidth(i.lc);let dwy=fwidth(i.wp.y); // derivatives must stay outside the branches
 let m=i.ma.x;let tint=i.ma.w;let L=u.sun.xyz;let vv=u.cam.xyz-i.wp;let d=length(vv);let V=vv/d;
 let ng=normalize(i.n);var n=ng;var alb=vec3f(.3);var ao=i.ma.y;var thin=0.;var sp=.12;var gl=24.;var em=vec3f(0.);var ak=1.;var rk=1.;var sf=0.;
 if(m<9.){ // rock family: terrain, ship, sculpture, boulders
  let p=i.wp;let lod=1./(1.+d*.03);
  let a=nd(p*.55);let b=nd(p*1.9+7.);let c=nd(p*6.3+3.);let e=nd(p*17.+1.);
  let up=ss(.55,.92,n.y)*step(m,.9);
  var g=a.yzw*.3+b.yzw*.3+(c.yzw*.45+e.yzw*.25*lod)*lod;
  alb=mix(vec3f(.12,.13,.18),vec3f(.36,.31,.27),a.x)*(.8+.4*c.x);
  if(m<.9){ // small sharp fractures at close range, so a wall that fills the view still has relief
   let nq=(1.-ss(5.,24.,d))*(1.-up);let c3=cell(p*vec3f(2.6,3.4,2.6)+b.x);
   alb*=mix(1.,ss(0.,.06,c3.w),nq*.65)*(1.+(c3.x-.5)*.3*nq);g+=(c3.xyz-.5)*1.2*nq;}
  if(m<.9||m>3.){ // natural rock, canyon and boulders alike: bedded strata. Each layer has its own tone, a lit top edge, a dark undercut and a few vertical joints.
   let ib=m>3.;let rw=select(1.-up*.9,1.,ib); // boulders bed along their own (tilted) axis
   let yy=select(p.y*.62,i.lc.y*3.3,ib)+a.x*.8+b.x*.25;let li=floor(yy);let lf=yy-li;let fy=select(dwy*.7,dq.y*3.6,ib);let sk=rw*(1.-ss(.15,.5,fy));
   let hh=h3(vec3i(i32(li),7,3));let ce=cell(vec3f(p.x*.3+hh*9.,li*1.7,p.z*.3)+a.x*.8);
   let bed=ss(0.,.38,lf);let ln=ss(0.,.05+fy,lf);let jt=mix(1.,ss(0.,.07,ce.w),step(.45,ce.y)*.6);
   alb*=mix(1.,(.6+.8*hh)*(.8+.4*ce.x)*jt,rw)*mix(1.,(.5+.5*bed)*(.6+.4*ln),sk);ao*=mix(1.,.55+.45*bed,sk);
   let bw=select(1.,.35,ib);g+=vec3f(ce.x-.5,0.,ce.z-.5)*1.6*rw*bw;g.y+=(ss(.72,1.,lf)*1.3-(1.-ss(0.,.3,lf))*1.9)*sk*bw;}
  if(m<.9){
   alb=mix(alb,alb*vec3f(.6,.5,.85),ss(.45,.7,b.x));
   let pu=ss(.5,.72,nd(p*.23+3.).x)*(1.-up);alb=mix(alb,vec3f(.42,.14,.46)*(.7+.6*b.x),pu*.75);
   alb=mix(alb,vec3f(.36,.33,.26)*(.75+.5*c.x),up*.85);g=mix(g,vec3f(cos(p.x*4.+b.x*7.+p.z*1.5)*.5,0.,0.)+e.yzw*.25*lod,up*.8); // rippled sand on the flats
   // under the ground cover: soft plum soil that blends into the sand, so the pink comes from the fronds
   let cv=ss(.2,.75,m/.85+(b.x-.5)*.5);
   alb=mix(alb,mix(vec3f(.17,.05,.15),vec3f(.36,.08,.27),a.x)*(.85+.3*c.x),cv*.9);sp=mix(sp,.03,cv);g+=e.yzw*.3*cv*lod;
  }else if(m<1.5){ // ship: planks along the hull, grain along the masts, algae on top faces, coralline crust
   let q=i.lc;let mst=step(min(min(length(q.xz-vec2f(12.,0.)),length(q.xz-vec2f(-13.,0.))),length(q.xz-vec2f(-1.+(q.y-6.)*.1,0.))),1.)*step(7.6,q.y);
   let pc=mix(select(q.y,q.z,abs(n.y)>.8)*1.9,(q.x-q.z)*2.4,mst)+b.x*.15;
   let fq=(dq.x+dq.y+dq.z)*2.2;let sk=1.-ss(.1,.4,fq); // seams get wider with the pixel footprint and fade out before they can alias
   let pl=abs(fract(pc)-.5);let seam=mix(1.,ss(.02,.07+fq,pl),sk);
   alb=mix(vec3f(.17,.115,.07),vec3f(.50,.34,.19),a.x)*(.4+.6*seam)*(.75+.5*fract(floor(pc)*.37+floor(q.x*.31)*.61));
   alb=mix(alb,vec3f(.07,.22,.15),ss(.3,.9,n.y)*.7*b.x+ss(.55,.8,a.x)*.5);
   alb=mix(alb,vec3f(.52,.20,.48)*(.6+.6*c.x),ss(.6,.9,b.x)*ss(.3,.7,c.x)*.55);
   alb=mix(alb,vec3f(.60,.55,.45),ss(.82,.9,c.x)*.6);g*=.6;g.y+=(1.-seam)*1.2*sign(fract(pc)-.5)*sk;
   ao=max(ao*(.6+.4*ss(-1.,5.,q.y)),.45);ak=2.2; // light bounced from the sand keeps the shadowed hull readable
  }else if(m<3.){ // sculpture: warm pale limestone, clearly lighter than the canyon wall; carved bands and fan grooves
   let q=i.lc;let lobe=ss(8.6,10.4,q.y);
   let fan=abs(fract(atan2(q.y-7.5,abs(q.x)+.5)*4.5)-.5);let band=abs(fract(q.y*.5+.2)-.5);
   let cut=mix(ss(.02,.07,band),ss(.03,.1,fan),lobe);let rm=cut*(1.-ss(.1,.26,mix(band,fan,lobe))); // lit rim beside each groove
   alb=mix(vec3f(.50,.44,.34),vec3f(.70,.61,.46),a.x)*(.82+.3*c.x)*(.68+.32*cut)*(1.+.3*rm);
   alb*=.6+.4*mix(1.,ss(.0,.02,abs(a.x-.5)),ss(.4,.6,b.x)); // a few long cracks
   let st=nd(vec3f(q.x*2.2,q.y*.3,q.z*2.2)+5.).x;alb=mix(alb,vec3f(.16,.42,.38),ss(.52,.85,st)*.22); // patina streaks
   alb=mix(alb,vec3f(.42,.14,.46)*(.6+.8*c.x),ss(.55,.75,b.x)*.7*(1.-ss(-2.,4.,q.y))); // growth near the base
   g=g*.5+vec3f(0.,(1.-cut)*1.4*(1.-lobe),0.);ao*=.6+.4*cut;sp=.22;gl=36.;ak=1.5;
  }else{ // boulders: the mesh carries the big faces; purple crust and moss on top
   alb=mix(alb,vec3f(.42,.14,.46),ss(.55,.75,b.x)*.5);alb=mix(alb,vec3f(.15,.36,.22)*(.7+.6*c.x),ss(.25,.9,n.y)*.6);}
  n=normalize(n-(g-n*dot(g,n))*.9);
 }else if(m<10.5){ // kelp
  thin=1.;let s=i.lc.x;
  if(i.lc.y<0.){alb=vec3f(.07,.085,.03);}
  else{let w=nd(i.wp*vec3f(7.,2.5,7.));n=normalize(n+w.yzw*.3);
   alb=mix(vec3f(.045,.095,.025),mix(vec3f(.30,.38,.06),vec3f(.62,.48,.09),fract(tint+i.lc.z)),s*.8+.15)*(.6+.4*ss(.0,.18,abs(i.ma.z)))*(.75+.5*w.x);ao=.5+.5*s;}
  sp=.3;gl=30.;
 }else if(m<11.5){ // iridescent bush: the hue moves with the view angle
  thin=1.;let f=clamp(1.-abs(dot(n,V)),0.,1.);let h=i.lc.y*2.3+tint*1.7+i.lc.x*.45+f*.7;
  alb=pal(h,vec3f(.30,.05,.56),vec3f(.88,.10,.50),vec3f(.50,.12,.82));alb=mix(alb,vec3f(.15,.55,.95),f*f*f*.35);
  alb*=(.3+.7*i.lc.x)*(.6+.4*ss(.0,.2,abs(i.ma.z)));em=alb*.2;sp=.06;gl=18.;ao=.45+.55*i.lc.x;
 }else if(m<12.5){ // ground-cover fronds: dark base, magenta body, slightly paler tip, darker midrib; tint and brightness vary per tuft and per frond
  thin=1.;let s=i.lc.x;let c=mix(vec3f(.92,.13,.56),vec3f(.62,.15,.90),tint);
  alb=mix(vec3f(.12,.02,.10),mix(c,vec3f(1.,.62,.84),ss(.6,1.,s)*.3),ss(.0,.5,s))*(.85+.3*fract(i.lc.y*7.31+tint*3.))*(.75+.25*ss(0.,.5,abs(i.ma.z)));
  ao=.3+.7*s;em=alb*.06*s;sp=.03;sf=.6;
 }else if(m<13.5){ // barrel sponge: matte, porous and mottled outside, dark hollow inside
  let lo=1./(1.+d*.07);let pr=nd(i.op*30.);let mo=nd(i.op*4.+tint*9.).x;
  let o=pal(tint*.999,vec3f(.98,.56,.20),vec3f(.96,.44,.62),vec3f(.66,.46,.95))*(.7+.6*mo);
  let rib=.72+.28*sin(i.lc.x*TAU*11.);let ins=ss(.70,.74,i.lc.y);
  alb=mix(o*rib*(.6+.4*i.lc.y/.72)*(1.-.6*ss(.52,.7,pr.x)*lo),vec3f(.10,.03,.04)*(1.-ss(.74,1.,i.lc.y)*.8),ins);
  n=normalize(n-pr.yzw*.4*lo);ao=mix(.5+.5*i.lc.y,.5,ins);sp=0.;rk=0.;em=alb*.05;
 }else if(m<14.5){ // branching coral, pale tips
  let c=pal(tint*.999,vec3f(.95,.32,.48),vec3f(1.,.50,.14),vec3f(.60,.42,.95));
  alb=mix(c*.5,mix(c,vec3f(1.,.93,.86),ss(.65,1.,i.lc.x)*.6),i.lc.x);ao=.45+.55*i.lc.x;em=c*.22*i.lc.x;sp=.08;
 }else if(m<15.5){ // mound coral: meandering ridges
  let r=nd(i.op*7.);let k=abs(r.x*2.-1.);let c=pal(tint*.999,vec3f(.70,.74,.22),vec3f(.18,.62,.55),vec3f(.85,.42,.55));
  alb=mix(c*.35,c,ss(.05,.5,k));n=normalize(n-r.yzw*.25*(1.-k));ao=1.-.45*i.lc.y;em=c*.04;sp=.06;
 }else if(m<20.5){ // fish: coloured back fading to a silver belly, pale flank band, eye; fins are thin and take the back colour
  let c=pal(tint*.999,vec3f(.08,.36,.95),vec3f(1.,.72,.08),vec3f(.96,.28,.20));
  if(i.lc.z>.5){thin=1.;alb=c*(.4+.5*i.lc.x);sp=.15;}
  else{let k=sin(i.lc.x*TAU);let v=i.lc.y;
   alb=mix(vec3f(.86,.90,.93),c,ss(-.55,.65,k));
   alb=mix(alb,vec3f(.97,.98,1.),(1.-ss(.0,.2,abs(k-.02)))*.5*ss(.12,.22,v)*(1.-ss(.6,.76,v)));
   alb=mix(alb,c*.75,ss(.74,.8,v));
   let ey=length((i.op.zy-vec2f(.385,.03))/.033);alb=mix(alb,vec3f(.96,.93,.80),1.-ss(.95,1.2,ey));alb=mix(alb,vec3f(.02,.02,.03),1.-ss(.5,.64,ey));
   sp=.8;gl=50.;}
 }else{ // manta: dark back with pale shoulder bars; pale belly with grey wing margins and gill slits
  let top=ss(.48,.52,1.-i.lc.x);let k=nd(i.op*5.).x;let a=abs(i.op.x);let z=i.op.z;
  var bel=mix(vec3f(.88,.90,.92),vec3f(.28,.34,.42),ss(.4,1.,a));bel=mix(bel,vec3f(.30,.36,.44),ss(.6,.78,k)*.5);
  let gr=ss(.05,.07,a)*(1.-ss(.2,.23,a))*ss(-.03,.0,z)*(1.-ss(.2,.23,z));
  bel=mix(bel,vec3f(.07,.09,.12),gr*(1.-ss(.1,.24,abs(fract(z*24.)-.5))));
  var bk=(vec3f(.03,.045,.07)+.035*k)*(1.25-.5*ss(0.,.9,a));let sx=(a-.3)/.17;let sz=(z-.2+.32*a)/.075;bk=mix(bk,vec3f(.46,.54,.60),exp(-sx*sx-sz*sz)*.7); // soft shoulder marks
  alb=mix(bel,bk,top);ao=.42+.58*abs(dot(n,V));sp=.35;gl=30.;}
 // ribbons: the vertex normal faces away from the viewer exactly when the triangle is front-facing (see rib() in gen2.js)
 if(thin>0.&&ff){n=-n;}
 let ndl=dot(n,L);let shd=shadow4(i.wp,n*sign(ndl+.0001)*mix(1.,.3,thin));
 // caustics belong on up-facing surfaces: on a wall the projected pattern stretches into ripples that read as water
 let cz=caus(cp,(1.-ss(.06,.45,cf))*mix(ss(-.15,.55,ng.y),1.,thin));let sun=sunAt(i.wp.y)*shd*(.5+1.5*cz);
 let dif=mix(mix(max(ndl,0.),abs(ndl)*.55+.3,thin),.72,sf); // sf: soft, even light for the small fronds
 let bk=thin*pow(max(dot(-V,L),0.),3.)*1.1;
 let hv=normalize(L+V);let rv=1.-clamp(dot(n,V),0.,1.);let rim=rv*rv*rv*(1.-thin)*rk;
 var col=alb*(sun*(.6+.4*ao)*(dif+bk)+amb(n,i.wp.y)*ak*ao*ao*(1.+rim*1.4))+sun*sp*pow(max(dot(n,hv),0.),gl)*step(0.,ndl)+em*exp(i.wp.y*.012)*3.;
 return vec4f(fog(min(col,vec3f(30.)),i.wp),1.);}
