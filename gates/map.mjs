// ASCII clearance map at a given height: '.' open (margin 2.5 m), '#' blocked. Usage: bun gates/map.mjs y x0 x1 z0 z1
import{readFileSync}from'fs';const[y,x0,x1,z0,z1]=process.argv.slice(2).map(Number);
const src=['gen1','gen2','gen3'].map(f=>readFileSync(new URL(`../src/${f}.js`,import.meta.url),'utf8')).join('\n');
console.log(new Function('Y','X0','X1','Z0','Z1',src+`;buildStatic();let o='';
for(let z=Z0;z<=Z1;z+=3){o+=String(z).padStart(5)+' ';for(let x=X0;x<=X1;x+=2)o+=clearAt(x,Y,z,2.5)?'.':'#';o+='\\n'}return o+'      x: '+X0+' .. '+X1+' step 2'`)(y,x0,x1,z0,z1));
