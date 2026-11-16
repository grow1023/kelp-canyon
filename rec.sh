#!/bin/bash
# Record evidence for the critic. Usage: ./rec.sh r07
#  fly.mp4          60 s scripted fly-through, 30 fps, rendered 2560x1440, stored 1280x720
#  burstN.mp4       1 s at 60 fps, native 2560x1440, intra-only (no inter-frame codec pulsing); burstN_png/ = 8 consecutive lossless frames
#  still1/still6    3 s at 30 fps with a FIXED camera (poses 1 and 6): only the scene moves
#  pan_start.mp4    8 s, camera at the start position turning a full 360 degrees (boundary check), stored 1280x720
#  surface0..3.png  native frames of the fly-through at 55, 55.5, 56 and 56.5 s (water surface)
R=$1; D="$(cd "$(dirname "$0")" && pwd)"; O="$D/cook/$R"; cd "$D"
cat <<JS | ./ab.sh eval --stdin >/dev/null 2>&1
self.__rec=null;(async()=>{const cv=document.querySelector('canvas'),sm=new OffscreenCanvas(1280,720),g=sm.getContext('2d');let n=0;
 const put=async(path,type,q)=>{const b=await new Promise(r=>cv.toBlob(r,type,q));await fetch('/$R/'+path,{method:'POST',body:b});n++};
 for(let f=0;f<1800;f++){__r(-1,f/30);g.drawImage(cv,0,0,1280,720);const b=await sm.convertToBlob({type:'image/jpeg',quality:.93});await fetch('/$R/fly/f'+String(f).padStart(4,'0')+'.jpg',{method:'POST',body:b});n++}
 const T=[6,30,47];for(let k=0;k<3;k++)for(let f=0;f<60;f++){__r(-1,T[k]+f/60);await put('b'+(k+1)+'/f'+String(f).padStart(2,'0')+'.jpg','image/jpeg',.97);if(f>=20&&f<28)await put('burst'+(k+1)+'_png/f'+f+'.png','image/png')}
 for(const p of[0,5])for(let f=0;f<90;f++){__r(p,20+f/30);await put('s'+(p+1)+'/f'+String(f).padStart(2,'0')+'.jpg','image/jpeg',.97)}
 for(let f=0;f<240;f++){__r(0,20+f/30,f/240*6.2832);g.drawImage(cv,0,0,1280,720);const b=await sm.convertToBlob({type:'image/jpeg',quality:.93});await fetch('/$R/pan/f'+String(f).padStart(3,'0')+'.jpg',{method:'POST',body:b});n++}
 for(let f=0;f<4;f++){__r(-1,55+f*.5);await put('surface'+f+'.png','image/png')}
 self.__rec=n+' frames'})();'started'
JS
for i in $(seq 1 120); do sleep 3; r=$(echo 'self.__rec' | ./ab.sh eval --stdin 2>/dev/null); case "$r" in *frames*) break;; esac; done; echo "$r"
ffmpeg -loglevel error -y -framerate 30 -i "$O/fly/f%04d.jpg" -c:v libx264 -bf 0 -crf 16 -pix_fmt yuv420p "$O/fly.mp4" || exit 1
ffmpeg -loglevel error -y -framerate 30 -i "$O/fly/f%04d.jpg" -vf "select='not(mod(n,90))',scale=640:360,tile=5x4" -frames:v 1 -q:v 3 "$O/fly_sheet.jpg"
# sudden brightness steps: mean luma of the upper half per frame; a step of 2.5 levels or more in one frame is listed
ffmpeg -loglevel error -framerate 30 -i "$O/fly/f%04d.jpg" -vf "crop=iw:ih/2:0:0,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - | awk -F= '/YAVG/{y=$2;if(n>0){d=y-p;if(d<0)d=-d;if(d>=2.5){c++;s=s sprintf(" %.2fs(%.1f)",n/30,y-p)}if(d>m)m=d}p=y;n++}END{printf "luma steps >=2.5 in one frame: %d, largest %.2f;%s\n",c,m,s}' | tee "$O/luma_steps.txt"
rm -rf "$O/fly"
for k in 1 2 3; do
 ffmpeg -loglevel error -y -framerate 60 -i "$O/b$k/f%02d.jpg" -c:v libx264 -g 1 -bf 0 -crf 10 -pix_fmt yuv420p "$O/burst$k.mp4"
 ffmpeg -loglevel error -y -i "$O/burst${k}_png/f20.png" -i "$O/burst${k}_png/f21.png" -filter_complex "[0]format=gbrp[a];[1]format=gbrp[b];[a][b]blend=all_mode=difference,lutrgb=r='clip(val*8,0,255)':g='clip(val*8,0,255)':b='clip(val*8,0,255)',scale=1920:-1,format=rgb24" -q:v 3 "$O/burst${k}_diff_x8.jpg"
 rm -rf "$O/b$k"
done
ffmpeg -loglevel error -y -framerate 30 -i "$O/pan/f%03d.jpg" -c:v libx264 -g 1 -bf 0 -crf 14 -pix_fmt yuv420p "$O/pan_start.mp4"; rm -rf "$O/pan"
for p in 1 6; do ffmpeg -loglevel error -y -framerate 30 -i "$O/s$p/f%02d.jpg" -c:v libx264 -g 1 -bf 0 -crf 10 -pix_fmt yuv420p "$O/still$p.mp4"; rm -rf "$O/s$p"; done
ls "$O" | tr '\n' ' '; du -sh "$O" | cut -f1
