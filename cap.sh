#!/bin/bash
# Capture the 6 fixed poses as lossless PNG into cook/<round>/. Usage: ./cap.sh r01
R=$1; D="$(dirname "$0")"
cat <<JS | "$D/ab.sh" eval --stdin
(async()=>{if(!self.__r)return 'no hook: '+document.querySelector('p').textContent;
 const cv=document.querySelector('canvas'),out=[];
 for(let i=0;i<6;i++){__r(i,20+i*3);__r(i,20+i*3);
  const b=await new Promise(r=>cv.toBlob(r,'image/png'));await fetch('/$R/p'+(i+1)+'.png',{method:'POST',body:b});out.push(b.size)}
 return cv.width+'x'+cv.height+' '+out.join(',')+' hud='+document.querySelector('p').textContent})()
JS
