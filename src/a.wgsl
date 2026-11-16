// a.wgsl: shared uniforms, hashing/noise, vertex animation, shadow + main vertex stages
struct U{vp:mat4x4f,svp:mat4x4f,cam:vec4f,sun:vec4f,res:vec4f,rt:vec4f,up:vec4f,fw:vec4f}
@group(0)@binding(0)var<uniform>u:U;
const TAU=6.2831853;
// the page rewrites these two before it compiles the shader: light-shaft steps and shadow map size for the detail level
const RN=32;const SM=4096.;
fn hu(x:u32)->u32{var v=x;v^=v>>16;v*=0x7feb352du;v^=v>>15;v*=0x846ca68bu;v^=v>>16;return v;}
fn h3(p:vec3i)->f32{return f32(hu((u32(p.x)*73856093u)^(u32(p.y)*19349663u)^(u32(p.z)*83492791u)))/4294967296.;}
fn h22(p:vec2i)->vec2f{let a=hu((u32(p.x)*73856093u)^(u32(p.y)*19349663u));return vec2f(f32(a&0xffffu),f32(a>>16))/65536.;}
// value noise with analytic gradient: x = value in [0,1], yzw = d/dp
fn nd(p:vec3f)->vec4f{let i=vec3i(floor(p));let f=fract(p);let w=f*f*(3.-2.*f);let dw=6.*f*(1.-f);
 let a=h3(i);let b=h3(i+vec3i(1,0,0));let c=h3(i+vec3i(0,1,0));let d=h3(i+vec3i(1,1,0));
 let e=h3(i+vec3i(0,0,1));let g=h3(i+vec3i(1,0,1));let h=h3(i+vec3i(0,1,1));let k=h3(i+vec3i(1,1,1));
 let k1=b-a;let k2=c-a;let k3=e-a;let k4=a-b-c+d;let k5=a-c-e+h;let k6=a-b-e+g;let k7=-a+b+c-d+e-g-h+k;
 return vec4f(a+k1*w.x+k2*w.y+k3*w.z+k4*w.x*w.y+k5*w.y*w.z+k6*w.z*w.x+k7*w.x*w.y*w.z,
  dw*vec3f(k1+k4*w.y+k6*w.z+k7*w.y*w.z,k2+k5*w.z+k4*w.x+k7*w.z*w.x,k3+k6*w.x+k5*w.y+k7*w.x*w.y));}
fn ss(a:f32,b:f32,x:f32)->f32{return smoothstep(a,b,x);}
fn rotY(v:vec3f,a:f32)->vec3f{let c=cos(a);let s=sin(a);return vec3f(v.x*c+v.z*s,v.y,v.z*c-v.x*s);}

struct WP{p:vec3f,n:vec3f}
// world position + normal of an animated instance vertex. mae = (material, ao, extra)
fn anim(pos:vec3f,nrm:vec3f,lc:vec3f,mae:vec3f,ip:vec4f,iq:vec4f)->WP{
 let t=u.cam.w;let m=mae.x;var p=pos;var o:WP;
 if(m>19.5){ // swimmers follow a closed orbit; the JS side validates the same curve against the terrain
  let mt=m>20.5;let ky=select(2.5,2.,mt);let kz=select(2.,1.5,mt);
  var r1=fract(iq.y*7.13);var r2=fract(iq.y*13.7);var r3=fract(iq.y*29.3);
  // a fish carries its slot in the school as three 7-bit numbers, so two fish never share a place
  if(!mt){let k=u32(iq.y*2097152.+.5);r1=f32(k&127u)/127.;r2=f32((k>>7u)&127u)/127.;r3=f32(k>>14u)/127.;}
  let q=t*select(2.2/(iq.w*1.5),1.3/(iq.w*1.25),mt)+select((r1-.5)*1.3,0.,mt)+iq.x;
  var c=ip.xyz+vec3f(sin(q)*iq.w,sin(2.*q-iq.x)*ky,cos(q)*iq.w*kz);
  let fw=normalize(vec3f(cos(q)*iq.w,2.*cos(2.*q-iq.x)*ky,-sin(q)*iq.w*kz));
  let rt=normalize(cross(vec3f(0.,1.,0.),fw));let up=cross(fw,rt);
  if(mt){let a=abs(p.x);p.y+=sin(t*1.5+iq.y*6.-a*1.3)*.34*a*a+.05*sin(t*1.5+iq.y*6.);
   if(p.z<-.4){let k=(-.4-p.z)*(-.4-p.z);p.y+=sin(t*1.1+p.z*2.5+iq.y*9.)*.16*k;p.x+=sin(t*.8+p.z*2.+iq.y*5.)*.12*k;}}
  else{c+=rt*(r2-.5)*4.4+up*(r3-.5)*3.2+fw*sin(t*.7+r2*40.)*.12;p.x+=sin(p.z*5.+t*(8.+4.*r3)+r1*40.+r2*17.)*.085*(.55-p.z);}
  // swimmers shrink to nothing just before they reach the camera, so the view never cuts through a body
  let dc=distance(c,u.cam.xyz);let nc=select(ss(.7,2.6,dc),ss(3.,6.5,dc),mt);
  o.p=c+(rt*p.x+up*p.y+fw*p.z)*ip.w*nc;o.n=rt*nrm.x+up*nrm.y+fw*nrm.z;return o;}
 var n=nrm;
 if(m>9.5&&m<10.5){ // kelp: whole column sways, fronds flutter along their normal
  let h=p.y;let a=pow(max(h,0.)/30.,1.4)*1.7;
  if(lc.y>=0.){p+=n*sin(t*1.6+lc.z+lc.x*3.+h*.3)*.14*lc.x;}
  p.x+=sin(t*.45+iq.y+h*.13)*a;p.z+=cos(t*.36+iq.y*1.7+h*.1)*a*.8;}
 else if(m>10.5&&m<11.5){let k=lc.x*lc.x*.16;p.x+=sin(t*.9+iq.y+lc.z)*k;p.z+=cos(t*.7+iq.y*1.3+lc.z)*k;}
 else if(m>11.5&&m<12.5){p.x+=sin(t*1.3+iq.y+lc.z)*.07*lc.x;p.z+=cos(t*1.1+iq.y)*.05*lc.x;
  p*=1.-ss(.72,1.,distance(ip.xyz,u.cam.xyz)/u.sun.w);} // ground cover shrinks into the soil before its draw distance ends, so no patch pops in
 o.p=ip.xyz+rotY(p*ip.w,iq.x);o.n=rotY(n,iq.x);return o;}

@vertex fn vsS(@location(0)pos:vec3f,@location(1)nrm:vec3f,@location(2)lc:vec3f,@location(3)mae:vec3f,@location(4)ip:vec4f,@location(5)iq:vec4f)->@builtin(position)vec4f{
 return u.svp*vec4f(anim(pos,nrm,lc,mae,ip,iq).p,1.);}

struct VO{@builtin(position)cp:vec4f,@location(0)wp:vec3f,@location(1)n:vec3f,@location(2)lc:vec3f,@location(3)ma:vec4f,@location(4)op:vec3f}
@vertex fn vsM(@location(0)pos:vec3f,@location(1)nrm:vec3f,@location(2)lc:vec3f,@location(3)mae:vec3f,@location(4)ip:vec4f,@location(5)iq:vec4f)->VO{
 let w=anim(pos,nrm,lc,mae,ip,iq);var o:VO;o.cp=u.vp*vec4f(w.p,1.);o.wp=w.p;o.n=w.n;o.lc=lc;o.ma=vec4f(mae,iq.z);o.op=pos;return o;}

// fullscreen triangle; instance index is forwarded so one pipeline can serve several directions
struct FO{@builtin(position)cp:vec4f,@location(0)@interpolate(flat)k:u32}
@vertex fn vsF(@builtin(vertex_index)vi:u32,@builtin(instance_index)ii:u32)->FO{
 var o:FO;o.cp=vec4f(f32(vi&1u)*4.-1.,f32(vi>>1u)*4.-1.,0.,1.);o.k=ii;return o;}
