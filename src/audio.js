// audio: the whole soundscape is one fixed Web Audio graph, synthesized from noise and sine waves (no sound files).
// Slow oscillators (LFOs) open and close every voice, so no script runs after the start. A = AudioContext or OfflineAudioContext.
const au=A=>{const sr=A.sampleRate,out=A.createGain(),G=(v,to)=>{const g=A.createGain();g.gain.value=v;g.connect(to);return g},
  O=(f,to)=>{const o=A.createOscillator();o.frequency.value=f;o.connect(to);o.start();return o},
  F=(type,f,q,to)=>{const b=A.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q;b.connect(to);return b};
 out.connect(A.destination);
 // brown noise, a 6 s loop; the first half second is cross-faded with the samples after the end, so the loop has no click
 const n=sr*6|0,xf=sr>>1,buf=A.createBuffer(1,n,sr),d=buf.getChannelData(0),tmp=new Float32Array(n+xf);let l=0;
 for(let i=0;i<n+xf;i++){l=(l+.02*(Math.random()*2-1))/1.02;tmp[i]=l*3.5}
 for(let i=0;i<n;i++)d[i]=i<xf?tmp[i]*(i/xf)+tmp[i+n]*(1-i/xf):tmp[i];
 const src=A.createBufferSource();src.buffer=buf;src.loop=true;src.start();
 // deep rumble, and a mid-band wash that swells slowly
 src.connect(F('lowpass',110,.7,G(.9,out)));
 const wash=G(.05,out);src.connect(F('bandpass',420,.5,wash));O(.07,G(.035,wash.gain));
 // gate curve: silent below 0.6, then a smooth rise. A slow LFO through it lets a voice through for a few seconds at a time
 const c=new Float32Array(257);for(let i=0;i<257;i++){const x=i/128-1;c[i]=x>.6?((x-.6)/.4)**2:0}
 const gate=()=>{const w=A.createWaveShaper();w.curve=c;return w};
 // distant calls: two sines whose pitch glides, about one call every 40 s, with an echo
 const vg=G(0,out),ech=A.createDelay(1),g1=gate();ech.delayTime.value=.43;vg.connect(ech);ech.connect(G(.4,ech));ech.connect(G(.5,out));g1.connect(G(.2,vg.gain));O(.026,g1);
 const v1=O(150,vg),v2=O(226,G(.4,vg));O(.11,G(38,v1.frequency));O(.11,G(57,v2.frequency));O(.9,G(4,v1.frequency));
 // bubbles: a narrow noise band near 1.5 kHz in short bursts
 const bg=G(0,out),g2=gate();src.connect(F('bandpass',1500,9,bg));g2.connect(G(7,bg.gain));O(.19,G(.6,g2));O(3.1,G(.5,g2));
 return out};
