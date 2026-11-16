// Runs the pure-JS world generator outside the browser and checks its invariants. Exit 1 on any failure.
import{readFileSync}from'fs';
const src=['gen1','gen2','gen3'].map(f=>readFileSync(new URL(`../src/${f}.js`,import.meta.url),'utf8')).join('\n');
const out=new Function(src+`
const t0=performance.now();buildStatic();const t1=performance.now();buildProps();buildInst();const t2=performance.now();
const fail=[];
if(nv*12>SV.length||ni>SI.length||nI*8>IB.length||nS*8>SP.length)fail.push('buffer overflow');
for(let i=0;i<nv*12;i++)if(!(SV[i]===SV[i])){fail.push('NaN in vertex '+floor(i/12)+' slot '+i%12);break}
let mx=0;for(let i=0;i<ni;i++)if(SI[i]>=nv){fail.push('index out of range');break}
// winding: geometric normal vs gradient normal over terrain triangles
let ok=0,tot=0;for(let i=0;i<M_TERR;i+=3){const a=SI[i]*12,b=SI[i+1]*12,c=SI[i+2]*12,ux=SV[b]-SV[a],uy=SV[b+1]-SV[a+1],uz=SV[b+2]-SV[a+2],vx=SV[c]-SV[a],vy=SV[c+1]-SV[a+1],vz=SV[c+2]-SV[a+2];
 const d=(uy*vz-uz*vy)*SV[a+3]+(uz*vx-ux*vz)*SV[a+4]+(ux*vy-uy*vx)*SV[a+5];tot++;if(d>0)ok++}
// fly path clearance
const bad=[];let minT=1e9;for(let u=0;u<NK-1;u+=.02){pathP(u,_a);minT=min(minT,td(_a[0],_a[1],_a[2]));if(!clearAt(_a[0],_a[1],_a[2],2.4))bad.push(u.toFixed(2)+':'+[..._a].map(v=>v.toFixed(0))+' td='+td(_a[0],_a[1],_a[2]).toFixed(1))}
if(bad.length)fail.push('path blocked at '+bad.length+' samples: '+bad.filter((_,i)=>i%6==0).slice(0,14).join(' | '));
for(let i=0;i<30;i+=5)if(!clearAt(POSES[i],POSES[i+1],POSES[i+2],1.2))fail.push('pose '+(i/5+1)+' is not in open water (y='+POSES[i+1].toFixed(1)+', floor='+gy(POSES[i],POSES[i+2]).toFixed(1)+')');
const need={kelp:1800,bush:1500,tuft:55000,rock0:5000,rock1:5000,sponge:150,mound:150,coral0:200,coral1:200,fish:2000,manta:9};
if(leaves()<1e6)fail.push('leaves '+leaves()+' < 1000000');
const got=Object.fromEntries(DL.map(d=>[d[0],d[2]]));for(const k in need)if(!(got[k]>=need[k]))fail.push(k+' count '+got[k]+' < '+need[k]);
stampSolid();if(td(POSES[0],POSES[1],POSES[2])<1.3)fail.push('start pose collides after stamping');
if(td(60,SHY+2,-26)>.5)fail.push('ship is not solid for the camera');if(td(BL[0],BL[1],BL[2])>0)fail.push('boulder is not solid for the camera');if(td(-4,FLY+3,-92)>.5)fail.push('sculpture is not solid for the camera');
buildChunks();{let ic=0,wi=0;for(let k=0;k<DR.length;k+=7){if(DR[k+3]==0&&DR[k+1]==1&&DR[k+2]<M.kelp[0])wi+=DR[k];else ic+=DR[k+1]}
 if(wi!=M.kelp[0])fail.push('world chunks cover '+wi+' of '+M.kelp[0]+' indices');if(ic!=nI-1)fail.push('instance chunks cover '+ic+' of '+(nI-1)+' instances');
 for(let i=0;i<M.kelp[0];i++)if(SI[i]>=nv){fail.push('index out of range after chunking');break}
 for(let i=0;i<CH_.length;i++)if(!(CH_[i]===CH_[i])){fail.push('NaN in chunk bounds');break}}
let aoS=0;for(let i=0;i<TVN;i++)aoS+=SV[i*12+10];
return{chunks:DR.length/7,leaves:leaves(),ms:[t1-t0,t2-t1].map(round),nv,ni,tris:ni/3,TVN,windingOK:(ok/tot).toFixed(4),minPathTD:minT.toFixed(2),inst:got,nI,nS,meshTris:Object.fromEntries(Object.entries(M).map(([k,v])=>[k,v[1]/3])),meanAO:(aoS/TVN).toFixed(3),SHY:SHY.toFixed(1),FLY:FLY.toFixed(1),startFloor:gy(0,36).toFixed(1),fail}`.replace('M_TERR','(()=>{let n=0;for(let i=0;i<ni;i+=3){if(SI[i]>=TVN)break;n=i+3}return n})()'))();
console.log(JSON.stringify(out,null,1));
process.exit(out.fail.length?1:0);
