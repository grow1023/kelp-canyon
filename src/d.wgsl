// d.wgsl: terrain density on the GPU. A compute shader fills the same grid that gen1.js T() defines; the page reads it back once.
// Keep this in step with T() in gen1.js: the page compares both at start-up and falls back to the CPU when they differ.
@group(0)@binding(0)var<storage,read_write>D:array<f32>;
struct P{g:vec4f,n:vec4u} // g = grid origin + cell size, n = points along x, y, z
@group(0)@binding(1)var<uniform>q:P;
fn H3(x:i32,y:i32,z:i32)->f32{var h=bitcast<u32>(x)*374761393u+bitcast<u32>(y)*668265263u+bitcast<u32>(z)*1440662683u;h=(h^(h>>13u))*1274126177u;return f32(h^(h>>16u))/4294967296.;}
fn n3(p:vec3f)->f32{let i=vec3i(floor(p));let f=p-floor(p);let w=f*f*(3.-2.*f);
 return mix(mix(mix(H3(i.x,i.y,i.z),H3(i.x+1,i.y,i.z),w.x),mix(H3(i.x,i.y+1,i.z),H3(i.x+1,i.y+1,i.z),w.x),w.y),
  mix(mix(H3(i.x,i.y,i.z+1),H3(i.x+1,i.y,i.z+1),w.x),mix(H3(i.x,i.y+1,i.z+1),H3(i.x+1,i.y+1,i.z+1),w.x),w.y),w.z)-.5;}
fn fb(p:vec3f)->f32{return n3(p)+.5*n3(p*2.03+vec3f(7.,0.,0.))+.25*n3(p*4.1+vec3f(0.,3.,0.));}
fn n2(x:f32,z:f32)->f32{return 2.*n3(vec3f(x,.5,z));}
fn sm(a:f32,b:f32,k:f32)->f32{let h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
fn sq(a:f32,b:f32,x:f32)->f32{let t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
fn T(p:vec3f)->f32{let x=p.x;let y=p.y;let z=p.z;let r=length(p.xz);let ds=length(vec2f(x,z-clamp(z,-100.,40.)));
 var AX=array<f32,12>(0.,-50.,-36.,22.,5.2,0.,30.,-50.,-26.,21.,4.6,1.5708);
 var h=-46.+5.*n2(x*.017,z*.017)+1.6*n2(x*.06+9.,z*.06);
 let wn=sq(.1,.34,abs(n2(x*.0105+3.1,z*.0105-1.7)+.35*n2(x*.027,z*.027+5.)));
 let w=mix(sq(27.,45.,ds+7.*n2(x*.03+2.,z*.03)),wn,sq(46.,90.,ds))*sq(40.,57.,length(vec2f(x-60.,z+26.))+6.*n2(x*.045+1.,z*.045+6.))*mix(1.,sq(.1,.3,abs(n2(x*.023+9.,z*.023+3.))),sq(34.,52.,ds));
 h+=w*(27.+22.*n2(x*.031+4.,z*.031-2.)+9.*n2(x*.09,z*.09+2.))+50.*sq(118.,170.,r);h=sm(h,-9.5+4.5*n2(x*.035,z*.035+7.)+1.5*n2(x*.11,z*.11),6.);
 var d=y-h;
 if(abs(d)<18.){let s=4.*w*(1.-w)+.5*sq(118.,150.,r);
  var t=y*.17+1.6*n2(x*.02,z*.02);t-=floor(t);let tr=select((1.-t)/.2,t/.8,t<.8);
  d+=fb(vec3f(x*.05,y*.08,z*.05))*13.*s+fb(p*.17)*2.4*(.35+s)+(tr-.5)*3.4*s+(abs(n2(x*.075+3.,z*.075))-.35)*8.*s;}
 for(var i=0;i<12;i+=6){let c=cos(AX[i+5]);let s=sin(AX[i+5]);let lx=(x-AX[i])*c+(z-AX[i+2])*s;let lz=(z-AX[i+2])*c-(x-AX[i])*s;let g=length(vec2f(lx,y-AX[i+1]))-AX[i+3];
  if(abs(g)<12.&&abs(lz)<12.){d=sm(d,length(vec2f(g,lz*.75))-AX[i+4]+fb(p*.11)*3.2+fb(p*.36)*1.3,4.);}}
 return max(d,y+3.2);}
@compute @workgroup_size(4,4,4)fn cT(@builtin(global_invocation_id)id:vec3u){if(id.x>=q.n.x||id.y>=q.n.y||id.z>=q.n.z){return;}
 D[id.x+id.y*q.n.x+id.z*q.n.x*q.n.y]=T(q.g.xyz+vec3f(id)*q.g.w);}
