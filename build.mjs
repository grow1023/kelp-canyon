// Build: minify WGSL by regex, concatenate the JS, minify with bun, inline into one index.html.
import{readFileSync as rd,writeFileSync as wr}from'fs';import{gzipSync}from'zlib';
const S=f=>rd(new URL('src/'+f,import.meta.url),'utf8');
const mw=s=>s.replace(/\/\/.*$/gm,'').replace(/\s+/g,' ').replace(/ ?([{}()\[\];,:=+\-*\/<>&|^%!?@]) ?/g,'$1').trim();
const wgsl=mw(['a','b','c'].map(f=>S(f+'.wgsl')).join('\n')),wgsld=mw(S('d.wgsl'));
// the page patches these tokens for the detail level: the build fails when the minifier changed them
for(const t of['RN=32','SM=4096.','texture_depth_multisampled_2d'])if(!wgsl.includes(t)){console.error('WGSL token missing: '+t);process.exit(1)}
wr(new URL('out/all.wgsl',import.meta.url),wgsl);wr(new URL('out/d.wgsl',import.meta.url),wgsld);
wr(new URL('out/all.js',import.meta.url),'const WGSL='+JSON.stringify(wgsl)+',WGSLD='+JSON.stringify(wgsld)+';\n'+['gen1','gen2','gen3','audio','main'].map(f=>S(f+'.js')).join('\n')+'\nexport{};'); // export{} marks the file as ESM; without it bun emits a CommonJS wrapper that never runs
const b=await Bun.build({entrypoints:[new URL('out/all.js',import.meta.url).pathname],minify:true,target:'browser',format:'iife'});
if(!b.success){console.error(b.logs.join('\n'));process.exit(1)}
const raw=await b.outputs[0].text();if(/exports:\{\}/.test(raw)){console.error('bundle is wrapped as CommonJS');process.exit(1)}
const js=raw.trim().replace(/<\/script/g,'<\\/script');
const css=`html,body{margin:0;height:100%;background:#021426;overflow:hidden;font:500 15px/1.6 system-ui,sans-serif;color:#eafcff}
canvas{width:100%;height:100%;display:block;touch-action:none}
[hidden]{display:none!important}
#hud{position:fixed;left:50%;bottom:6%;transform:translateX(-50%);margin:0;padding:.7em 1.2em;width:max-content;max-width:88vw;box-sizing:border-box;background:#02182ccc;border-radius:14px;text-align:center;white-space:pre-line}
#hud,#ui{word-break:keep-all;overflow-wrap:anywhere}
#ui{position:fixed;inset:0;display:flex;padding:16px;box-sizing:border-box;background:#02142680;backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);overflow:auto}
#card{margin:auto;width:min(100%,430px);padding:28px 26px;box-sizing:border-box;background:#031c33e6;border:1px solid #9fe8ff33;border-radius:20px;text-align:center}
h1{margin:0;font:650 30px/1.2 system-ui,sans-serif;letter-spacing:.01em;text-wrap:balance}
#sub{margin:.5em 0 1.4em;color:#b9e3ee;text-wrap:pretty}
#tr{height:8px;border-radius:8px;background:#ffffff1f;overflow:hidden}
#bar{height:100%;width:0;border-radius:8px;background:#5fe0d0;transition:width .25s}
#st{margin:.8em 0 0;min-height:1.6em;color:#b9e3ee}
button{font:inherit;color:inherit;min-height:44px;padding:0 16px;border-radius:12px;border:1px solid #9fe8ff55;background:#ffffff14;cursor:pointer}
button:hover{background:#ffffff26}
button:focus-visible{outline:3px solid #ffd76a;outline-offset:2px}
#go{width:100%;min-height:52px;font-weight:650;font-size:17px;color:#02202c;background:#5fe0d0;border-color:#5fe0d0}
#go:hover{background:#86ecdf}
dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:1.4em 0;text-align:left}
dt{color:#ffe7a3;font-weight:600;white-space:nowrap}
dd{margin:0;color:#d5eff5}
#ql{display:flex;gap:8px;align-items:center;margin-bottom:10px}
#ql span{flex:1;text-align:left}
#ql button[aria-pressed=true]{color:#02202c;background:#ffd76a;border-color:#ffd76a;font-weight:650}
#snd{width:100%}
#nt{margin:1em 0 0;font-size:13px;color:#9cc7d3;text-wrap:pretty}
#mb{position:fixed;top:12px;right:12px;width:48px;min-height:48px;padding:0;font-size:22px;background:#02182ccc}`.replace(/\n/g,'');
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kelp Canyon</title><style>${css}</style><canvas aria-label="수중 장면"></canvas><p id="hud" role="status" hidden></p><button id="mb" type="button" aria-label="메뉴 열기" hidden>≡</button><div id="ui"><div id="card"><h1>Kelp Canyon</h1><p id="sub">브라우저 안에서 헤엄치는 바닷속 협곡입니다. 그림 파일과 소리 파일 없이 코드로만 만들었습니다.</p><div id="ld"><div id="tr"><div id="bar"></div></div><p id="st" role="status"></p></div><div id="mn" hidden><button id="go" type="button">잠수하기</button><dl><dt>W A S D</dt><dd>이동</dd><dt>마우스</dt><dd>시점</dd><dt>Q / E</dt><dd>상승 / 하강</dd><dt>Shift</dt><dd>가속</dd><dt>1 ~ 6</dt><dd>명소로 이동</dd><dt>M · H</dt><dd>소리 · 성능 표시</dd><dt>Esc</dt><dd>이 메뉴로 돌아오기</dd><dt>터치</dt><dd>왼쪽 화면은 이동, 오른쪽 화면은 시점</dd></dl><div id="ql" role="group" aria-label="세부 묘사 수준"><span>세부 묘사</span><button type="button" data-q="2">낮음</button><button type="button" data-q="1">보통</button><button type="button" data-q="0">높음</button></div><button id="snd" type="button" aria-pressed="true">소리 켜짐</button><p id="nt">느린 기기에서는 60 fps를 지키도록 해상도와 그리는 거리를 자동으로 조절합니다. 세부 묘사를 바꾸면 세계를 다시 만듭니다.</p></div></div></div><script>${js}</script>`;
wr(new URL('index.html',import.meta.url),html);
console.log(JSON.stringify({bytes:Buffer.byteLength(html),gzip:gzipSync(html,{level:9}).length,wgsl:wgsl.length+wgsld.length}));
