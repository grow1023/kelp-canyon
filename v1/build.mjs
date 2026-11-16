// Build: minify WGSL by regex, concatenate the JS, minify with bun, inline into one index.html.
import{readFileSync as rd,writeFileSync as wr}from'fs';import{gzipSync}from'zlib';
const S=f=>rd(new URL('src/'+f,import.meta.url),'utf8');
const wgsl=['a','b','c'].map(f=>S(f+'.wgsl')).join('\n').replace(/\/\/.*$/gm,'').replace(/\s+/g,' ').replace(/ ?([{}()\[\];,:=+\-*\/<>&|^%!?@]) ?/g,'$1').trim();
wr(new URL('out/all.wgsl',import.meta.url),wgsl);
wr(new URL('out/all.js',import.meta.url),'const WGSL='+JSON.stringify(wgsl)+';\n'+['gen1','gen2','gen3','main'].map(f=>S(f+'.js')).join('\n')+'\nexport{};'); // export{} marks the file as ESM; without it bun emits a CommonJS wrapper that never runs
const b=await Bun.build({entrypoints:[new URL('out/all.js',import.meta.url).pathname],minify:true,target:'browser',format:'iife'});
if(!b.success){console.error(b.logs.join('\n'));process.exit(1)}
const raw=await b.outputs[0].text();if(/exports:\{\}/.test(raw)){console.error('bundle is wrapped as CommonJS');process.exit(1)}
const js=raw.trim().replace(/<\/script/g,'<\\/script');
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kelp Canyon</title><style>html,body{margin:0;height:100%;background:#021426;overflow:hidden}canvas{width:100%;height:100%;display:block}p{position:fixed;left:50%;bottom:6%;transform:translateX(-50%);margin:0;padding:.7em 1.2em;width:max-content;max-width:88vw;box-sizing:border-box;font:500 15px/1.6 system-ui,sans-serif;color:#eafcff;background:#02182ccc;border-radius:14px;text-align:center;word-break:keep-all;overflow-wrap:anywhere;white-space:pre-line}</style><canvas aria-label="수중 장면"></canvas><p role="status"></p><script>${js}</script>`;
wr(new URL('index.html',import.meta.url),html);
console.log(JSON.stringify({bytes:Buffer.byteLength(html),gzip:gzipSync(html,{level:9}).length,wgsl:wgsl.length}));
