// c.wgsl: caustic map, water surface seen from below, sprites, god rays + bloom source, blur, final grade
@group(0)@binding(5)var dt:texture_depth_multisampled_2d;
@group(0)@binding(6)var ht:texture_2d<f32>;
@group(0)@binding(7)var bt:texture_2d<f32>;
@group(0)@binding(8)var lc:sampler;

// periodic Voronoi edge distance (F2-F1) with animated sites
fn vor(p:vec2f,n:i32,t:f32)->f32{let ip=vec2i(floor(p));let f=fract(p);var d1=9.;var d2=9.;
 for(var j=-1;j<=1;j++){for(var i=-1;i<=1;i++){let g=vec2i(i,j);let c=((ip+g)%vec2i(n)+vec2i(n))%vec2i(n);let h=h22(c);
  let o=.5+.4*sin(t*(.5+h.yx)+TAU*h);let r=vec2f(g)+o-f;let d=dot(r,r);if(d<d1){d2=d1;d1=d;}else if(d<d2){d2=d;}}}
 return sqrt(d2)-sqrt(d1);}
@fragment fn fsC(i:FO)->@location(0)vec4f{let t=u.cam.w;let uv=i.cp.xy/512.;
 let w=uv+.012*vec2f(sin(TAU*(uv.y*3.+t*.11)),cos(TAU*(uv.x*3.-t*.09)));
 let a=vor(w*6.,6,t*.9);let b=vor(w*10.+vec2f(.5),10,t*1.2+4.);
 let la=pow(1.-clamp(a/.42,0.,1.),4.);let lb=pow(1.-clamp(b/.42,0.,1.),4.);
 return vec4f(la*.75+lb*.4+la*lb*.5,0.,0.,1.);}

struct SO{@builtin(position)cp:vec4f,@location(0)wp:vec3f}
@vertex fn vsW(@builtin(vertex_index)vi:u32)->SO{let q=vec2f(f32(vi&1u),f32(vi>>1u))*4.-1.;
 var o:SO;o.wp=vec3f(u.cam.x+q.x*650.,0.,u.cam.z+q.y*650.);o.cp=u.vp*vec4f(o.wp,1.);return o;}
// gradient of the wave height field. Ten waves. Their directions step by the golden angle with jitter, so no two or three
// directions repeat (a fixed step near 120 degrees gave a lattice of lozenges). Frequencies grow by uneven ratios, each wave
// travels in groups (its amplitude changes along and across the crest), crests are sharpened, and two slow warps bend the field.
// k = pixel footprint on the surface: each wave fades out before it gets smaller than a few pixels, so the far surface cannot shimmer.
fn wav(p:vec2f,t:f32,k:f32)->vec2f{var g=vec2f(0.);var f=.15;var an=.4;var s=.19;
 var q=p+3.*vec2f(sin(p.y*.061+t*.11)+sin(p.x*.037+p.y*.029-t*.07),sin(p.x*.053-t*.09)+sin(p.y*.041-p.x*.023+t*.05))
  +1.2*vec2f(sin(p.y*.23+p.x*.11-t*.21),sin(p.x*.19-p.y*.07+t*.17));
 for(var j=0;j<10;j++){let fj=f32(j);let dir=vec2f(cos(an),sin(an));let pe=vec2f(-dir.y,dir.x);
  let ph=dot(q,dir)*f+t*(1.+.33*fj)+fj*1.7;
  let gr=.5+.5*sin(dot(q,pe)*f*.31+fj*2.3+t*.17)*sin(dot(q,dir)*f*.13+fj*4.1-t*.11);
  let w=f*k;g+=dir*s*gr*cos(ph+.7*sin(ph))/(1.+w*w);
  q+=pe*sin(ph)*.06/f;an+=2.39996+.4*sin(fj*1.31+.5);f*=1.33+.3*fract(fj*.618+.2);s*=.94;}
 return g;}
@fragment fn fsW(i:SO)->@location(0)vec4f{let v=i.wp-u.cam.xyz;let d=length(v);let rd=v/d;
 let g=wav(i.wp.xz,u.cam.w,d*.0028/max(rd.y,.03));let n=normalize(vec3f(g.x,-1.,g.y));
 let ci=max(-dot(rd,n),0.);let k=1.-1.777*(1.-ci*ci); // cos^2 of the refracted angle; 0 or less is total internal reflection
 let rf=refract(rd,n,1.333); // the zero vector on total internal reflection
 let L=u.sun.xyz;let la=vec3f(L.x*1.333,sqrt(max(1.-1.777*dot(L.xz,L.xz),0.)),L.z*1.333); // sun direction above the water (Snell)
 let sd=max(dot(rf,la),0.);
 // sky through Snell's window: pale at the rim, saturated blue overhead, a wide glow and glints around the sun
 let sky=mix(vec3f(.50,.84,.95),vec3f(.05,.33,.82),ss(.05,.7,rf.y))*1.15+SUNC*(pow(sd,700.)*60.+pow(sd,60.)*2.2+pow(sd,8.)*.4+sd*sd*.2);
 // the window fades over a wide range of angles, so its edge is a soft gradient and not a hard two-tone pattern
 let tr=ss(0.,.5,k)*(1.-pow(1.-clamp(rf.y,0.,1.),5.));
 // the top layer is clearer than the deep water, so the surface stays readable from the canyon floor
 return vec4f(fog(mix(fogc(reflect(rd,n),40.)*1.25,sky,tr),u.cam.xyz+v*.5),1.);}

@vertex fn vsK(@builtin(vertex_index)vi:u32)->@builtin(position)vec4f{return vec4f(f32(vi&1u)*4.-1.,f32(vi>>1u)*4.-1.,.9999999,1.);}
@fragment fn fsK(@builtin(position)p:vec4f)->@location(0)vec4f{let uv=p.xy/u.res.xy;
 return vec4f(fogc(normalize(u.fw.xyz+u.rt.xyz*(uv.x*2.-1.)+u.up.xyz*(1.-uv.y*2.)),300.),1.);}

struct PO{@builtin(position)cp:vec4f,@location(0)uv:vec2f,@location(1)c:vec4f,@location(2)@interpolate(flat)k:f32,@location(3)@interpolate(flat)s:f32}
@vertex fn vsP(@builtin(vertex_index)vi:u32,@location(0)ip:vec4f,@location(1)q:vec4f)->PO{
 let t=u.cam.w;let cn=vec2f(f32(vi&1u),f32(vi>>1u))*2.-1.;var p=ip.xyz;var sz=ip.w;var c=vec4f(0.);let k=q.x;
 if(k<.5){ // marine snow: a 46 m cube of particles that wraps around the camera
  let f=fract(p+vec3f(sin(t*.05+q.y*TAU)*.01,-t*.0025*(.5+q.z),cos(t*.04+q.w*TAU)*.01)-u.cam.xyz/46.)-.5;
  p=u.cam.xyz+f*46.;c=vec4f(vec3f(.5,.82,.88)*.5*exp(p.y*.01),.55*(1.-ss(.36,.5,max(abs(f.x),max(abs(f.y),abs(f.z))))));
 }else if(k<1.5){ // bubbles rise through a column of height q.z and widen on the way
  let H=q.z;let fr=fract(q.y+t*(.9+1.1*fract(q.y*17.3+q.w))/H);
  p.y+=fr*H;let wb=.1+fr*H*.03;
  p.x+=sin(t*2.3+q.y*40.)*wb+(fract(q.y*91.7)-.5)*fr*H*.06;p.z+=cos(t*1.9+q.y*57.)*wb+(fract(q.y*37.3)-.5)*fr*H*.06;
  sz*=1.+fr*.7;c=vec4f(vec3f(.7,.95,1.)*exp(p.y*.008),ss(0.,.03,fr)*(1.-ss(.93,1.,fr)));
 }else{ // green and gold specks around the kelp
  p+=vec3f(sin(t*.5+q.y*30.),sin(t*.4+q.y*50.),cos(t*.45+q.y*70.))*.35;
  // no pow() here: a base that rounds below zero gives NaN, and one NaN pixel spreads through the bloom as a bright grid
  let s=.5+.5*sin(t*(1.5+3.*q.z)+q.y*50.);let s2=s*s;let s4=s2*s2;
  // far specks fade out: a field of pinpoints over distant kelp reads as noise
  c=vec4f(mix(vec3f(.35,1.,.30),vec3f(1.,.78,.22),step(.45,q.w))*(.25+5.*s4*s4),1.-.9*ss(16.,48.,distance(p,u.cam.xyz)));}
 let v=p-u.cam.xyz;let d=length(v);
 // keep sub-pixel sprites at 1.1 px and trade the lost area for opacity, so they do not flicker
 let px=sz/max(dot(v,u.fw.xyz),.05)*u.res.y*.5/length(u.up.xyz);let k2=min(1.,px/1.1);
 c.a*=k2*k2*select(ss(.4,1.6,d),ss(1.5,7.,d),k>.5&&k<1.5)*exp(-d*.03); // bubbles fade out over metres, not in one frame
 var o:PO;o.cp=u.vp*vec4f(p+(normalize(u.rt.xyz)*cn.x+normalize(u.up.xyz)*cn.y)*sz/k2,1.);o.uv=cn;o.c=c;o.k=k;o.s=px;return o;}
@fragment fn fsP(i:PO)->@location(0)vec4f{let r=length(i.uv);
 if(i.k<.5){let a=max(1.-r*r,0.);return vec4f(i.c.rgb,1.)*a*a*i.c.a;}
 if(i.k<1.5){let a=mix(.4*(1.-ss(.2,1.,r)),ss(.5,.9,r)*(1.-ss(.9,1.,r))*.7+(1.-ss(0.,.3,length(i.uv-vec2f(-.35,.4))))+.06*(1.-ss(.9,1.,r)),ss(3.,8.,i.s))*i.c.a;return vec4f(i.c.rgb*a,a*.35);}
 return vec4f(i.c.rgb*max(exp(-r*r*5.)-.0067,0.)*i.c.a,0.);}

fn ign(p:vec2f)->f32{return fract(52.9829189*fract(dot(p,vec2f(.06711056,.00583715))));}
// half resolution: a = light shafts marched through the shadow map and caustic map, rgb = bloom source
@fragment fn fsR(i:FO)->@location(0)vec4f{
 let uv=i.cp.xy*2./u.res.xy;let z=textureLoad(dt,vec2i(i.cp.xy*2.),0);
 let A=u.res.w/(u.res.w-u.res.z);let zl=A*u.res.z/(A-z);
 let dir=u.fw.xyz+u.rt.xyz*(uv.x*2.-1.)+u.up.xyz*(1.-uv.y*2.);let ln=length(dir);let rd=dir/ln;
 var tm=min(zl*ln,100.);if(rd.y>0.){tm=min(tm,(-.2-u.cam.y)/rd.y);}
 let st=tm/f32(RN);var t=st*ign(i.cp.xy);var acc=0.;
 for(var j=0;j<RN;j++){let p=u.cam.xyz+rd*t;
  let c=textureSampleLevel(ct,ls,cuv(p)*.021+vec2f(u.cam.w*.004,0.),0.).r;
  // the first metres count little: otherwise one leaf shadow at the lens switches every shaft on the screen off at once
  acc+=shadow(p)*(.04+3.2*c*c)*exp(-t*.03+p.y*.016)*min(t*.09,1.);t+=st;}
 let ph=.5+1.3*pow(max(dot(rd,u.sun.xyz),0.),3.);
 // clamp first: max() and min() drop a NaN, so one bad pixel cannot spread through the blur
 let col=min(max(textureSampleLevel(ht,lc,uv,0.).rgb,vec3f(0.)),vec3f(40.));let lum=dot(col,vec3f(.3,.59,.11));
 return vec4f(col*ss(.9,2.4,lum),acc*st*ph*.027);}
@fragment fn fsB(i:FO)->@location(0)vec4f{let px=vec2f(2.)/u.res.xy;let uv=i.cp.xy*px;let dv=select(vec2f(0.,px.y),vec2f(px.x,0.),i.k==0u)*1.5;
 return textureSampleLevel(bt,lc,uv,0.)*.227+(textureSampleLevel(bt,lc,uv+dv*1.3846,0.)+textureSampleLevel(bt,lc,uv-dv*1.3846,0.))*.316
  +(textureSampleLevel(bt,lc,uv+dv*3.2308,0.)+textureSampleLevel(bt,lc,uv-dv*3.2308,0.))*.0703;}
// the scene is rendered at u.res and scaled up to the canvas (rt.w x up.w) here: dynamic resolution
@fragment fn fsO(i:FO)->@location(0)vec4f{let uv=i.cp.xy/vec2f(u.rt.w,u.up.w);
 var col=max(textureSampleLevel(ht,lc,uv,0.).rgb,vec3f(0.));let b=textureSampleLevel(bt,lc,uv,0.);
 let ry=normalize(u.fw.xyz+u.rt.xyz*(uv.x*2.-1.)+u.up.xyz*(1.-uv.y*2.)).y;
 col+=b.rgb*.45+mix(vec3f(.08,.36,.85),vec3f(.26,.74,.82),ss(-.1,.6,ry))*b.a;
 let q=uv-.5;col*=1.-dot(q,q)*.5;
 col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14); // ACES fit (Narkowicz)
 col=pow(clamp(col,vec3f(0.),vec3f(1.)),vec3f(1./2.2));
 col=mix(vec3f(dot(col,vec3f(.3,.59,.11))),col,1.1);
 // triangular dither: the deep-blue gradients band in 8 bits without it
 return vec4f(col+(ign(i.cp.xy)+ign(i.cp.xy+vec2f(37.,91.))-1.)/255.,1.);}
