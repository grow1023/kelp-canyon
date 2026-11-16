# Artifact variant of index.html. The Artifact host wraps the page in its own document skeleton and passes only a #hash
# (no query string), so this variant drops doctype/html/meta, uses colour tokens with a fixed dark scheme, and reads the mode from the hash too.
import re,sys,pathlib
d=pathlib.Path(__file__).parent;s=(d/'index.html').read_text()
m=re.match(r'<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport"[^>]*><title>Kelp Canyon</title><style>.*?</style>(<canvas[^>]*></canvas>)<p role="status"></p><script>(.*)</script>$',s,re.S)
if not m:sys.exit('index.html does not have the expected shape')
js=m.group(2)
if js.count('location.search')!=1:sys.exit('expected exactly one location.search')
js=js.replace('location.search','(location.search+location.hash)')
css=""":root{--bg:#021426;--fg:#eafcff;--panel:#02182ccc;color-scheme:dark}
html,body{margin:0;height:100%;box-sizing:border-box;background:var(--bg);overflow:hidden}
canvas{width:100%;height:100%;display:block}
p{position:fixed;left:50%;bottom:calc(6% + env(safe-area-inset-bottom,0px));transform:translateX(-50%);margin:0;padding:.7em 1.2em;width:max-content;max-width:88vw;box-sizing:border-box;font:500 15px/1.6 system-ui,sans-serif;color:var(--fg);background:var(--panel);border-radius:14px;text-align:center;word-break:keep-all;overflow-wrap:anywhere;white-space:pre-line}"""
out='<title>Kelp Canyon</title>\n<style>\n/* one-screen WebGPU scene: a full-bleed canvas and one status line; single dark look by design */\n'+css+'\n</style>\n'+m.group(1)+'<p role="status" lang="ko"></p>\n<script>'+js+'</script>\n'
(d/'artifact'/'kelp-canyon.html').write_text(out);print(len(out.encode()),'bytes')
