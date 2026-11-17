"""Original 16-bar garden theme: composition, synthesized instruments and loop export."""
from pathlib import Path
import wave,struct,json
import numpy as np
from scipy.signal import butter,sosfilt
RATE=44100;BPM=104;BEATS=64
root=Path(__file__).resolve().parents[1];out=root/'output'/'audio';out.mkdir(parents=True,exist_ok=True)
N=round(RATE*BEATS*60/BPM);beat=N/RATE/BEATS;rng=np.random.default_rng(20261117)
mix=np.zeros((N,2),dtype=np.float64);score=[]
def freq(note):return 440*2**((note-69)/12)
def add(t,x,gain=1,pan=0):
 start=round(t*RATE)%N;angle=(pan+1)*np.pi/4;stereo=x[:,None]*np.array([np.cos(angle),np.sin(angle)])[None,:]*gain
 while len(stereo):
  take=min(len(stereo),N-start);mix[start:start+take]+=stereo[:take];stereo=stereo[take:];start=0

def instrument(kind,note,duration,velocity=1):
 f=freq(note);t=np.arange(round(duration*RATE))/RATE;attack=1-np.exp(-t/(.0025 if kind!='pad' else .13));x=np.zeros_like(t)
 if kind=='mallet':
  for ratio,amp,decay in [(1,1,.33),(3.99,.20,.10),(10.65,.035,.034)]:
   if f*ratio<RATE*.45:x+=amp*np.sin(2*np.pi*f*ratio*t)*np.exp(-t/decay)
  x+=rng.normal(0,1,len(t))*.012*np.exp(-t/.006)
 elif kind=='pluck':
  for h in range(1,9):x+=np.sin(2*np.pi*f*h*t+.07*h)/h**1.65*np.exp(-t/(.4/(1+.24*h)))
 elif kind=='bass':
  x=np.sin(2*np.pi*f*t)*np.exp(-t/.32)+.32*np.sin(2*np.pi*2*f*t)*np.exp(-t/.18)+.11*np.sin(2*np.pi*3*f*t)*np.exp(-t/.12)
 elif kind=='pad':
  for offset,amp in [(-.0015,.2),(0,.55),(.0015,.2)]:x+=amp*np.sin(2*np.pi*f*(1+offset)*t)
  attack*=np.minimum(1,np.maximum(0,(duration-t)/.3))
 tail=min(len(t),round(.025*RATE));x[-tail:]*=np.linspace(1,0,tail)
 return x*attack*velocity

def note(kind,pitch,onset,length,vel,pan=0):
 duration=length*beat;add(onset*beat,instrument(kind,pitch,duration),vel,pan);score.append((kind,pitch,onset,length,vel))
# Original four-bar A motif, then a lifted answering phrase B.
A=[[(0,76,.8),(1,79,1),(2.5,81,.45),(3,79,.75)],[(0,76,.7),(1,74,.65),(2,72,1.6)],[(0,74,.55),(.75,76,.55),(1.5,79,.9),(3,76,.7)],[(0,74,.7),(1,71,.7),(2.5,74,.9)]]
B=[[(0,77,.8),(1.5,81,.55),(2.5,79,.6),(3.25,77,.55)],[(0,76,.9),(1.5,79,.7),(3,76,.65)],[(0,74,.5),(.75,77,.55),(1.5,76,.6),(2.5,74,.65)],[(0,71,.8),(1.5,74,.7),(3,79,.65)]]
chords=[(48,[60,64,67,69]),(45,[57,60,64,67]),(41,[57,60,64,65]),(43,[55,60,62,67]),(48,[60,64,67,69]),(45,[57,60,64,67]),(38,[57,60,62,65]),(43,[55,59,62,65]),(41,[57,60,64,65]),(40,[55,60,64,67]),(38,[57,60,62,65]),(43,[55,59,62,67]),(41,[57,60,64,65]),(45,[57,60,64,67]),(43,[55,59,62,65]),(48,[60,64,67,69])]
for bar,(bass,chord) in enumerate(chords):
 base=bar*4
 phrase=(B if 8<=bar<12 else A)[bar%4]
 if bar==15:phrase=[(0,74,.65),(1,76,.7),(2.25,72,1.3)]
 for k,(pos,pitch,length) in enumerate(phrase):
  note('mallet',pitch,base+pos,length+.4,.20 if bar<8 else .22,(-.08 if k%2 else .08))
 # Offbeat fingerpicked chord notes, lightly humanized and voiced above the bass.
 for k,pos in enumerate([.5,1.5,2.5,3.5]):
  pitch=chord[k%4];note('pluck',pitch,base+pos+rng.uniform(-.012,.012),.95,.065+rng.uniform(-.006,.006),-.32 if k%2 else .32)
 note('bass',bass,base,.95,.15,-.02);note('bass',bass+12,base+2,1.0,.065,.02)
 for pitch in chord[:3]:note('pad',pitch,base+.025,3.95,.014,-.22 if pitch%2 else .22)
 # Soft brush shaker, with a little swing; no hard snare or aggressive kick.
 for k in range(8):
  pos=k*.5+(.035 if k%2 else 0);t=np.arange(round(.065*RATE))/RATE
  noise=sosfilt(butter(2,[4000,10000],btype='bandpass',fs=RATE,output='sos'),rng.normal(size=len(t)))
  add((base+pos)*beat,noise*np.exp(-t/.016),.016 if k%2 else .010,.25 if k%2 else -.25)
 for pos in [0,2]:
  t=np.arange(round(.14*RATE))/RATE;phase=2*np.pi*(85*t+65*.023*(1-np.exp(-t/.023)))
  add((base+pos)*beat,np.sin(phase)*np.exp(-t/.04)*np.minimum(1,t/.003),.065)
 for pos in [1,3]:
  t=np.arange(round(.055*RATE))/RATE;wood=np.sin(2*np.pi*720*t)*np.exp(-t/.012)+.25*np.sin(2*np.pi*1630*t)*np.exp(-t/.006)
  add((base+pos+.012)*beat,wood*np.minimum(1,t/.001),.035,-.15)
# Periodic stereo room: every tail wraps into the first bar, so no faded gap is needed.
dry=mix.copy();room=sosfilt(butter(1,3100,fs=RATE,output='sos'),np.concatenate([dry,dry,dry]),axis=0)[N:2*N]
for delay,gain in [(.061,.12),(.097,.09),(.143,.065),(.211,.035)]:mix+=np.roll(room[:,::-1],round(delay*RATE),axis=0)*gain
mix-=mix.mean(axis=0);mix=np.tanh(mix*1.15);mix*=.79/np.max(np.abs(mix));pcm=np.rint(mix*32767).astype('<i2')
file=out/'bucket-garden-loop-v1.wav'
with wave.open(str(file),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(pcm.tobytes())
# A small MIDI score makes the original composition editable in any DAW.
def vlq(n):
 data=[n&127];n>>=7
 while n:data.insert(0,(n&127)|128);n>>=7
 return bytes(data)
def track(events):
 events.sort(key=lambda e:(e[0],e[1][0]>>4==9));data=b'';last=0
 for tick,msg in events:data+=vlq(tick-last)+msg;last=tick
 data+=vlq(max(0,BEATS*480-last))+b'\xff\x2f\x00';return b'MTrk'+struct.pack('>I',len(data))+data
tracks=[];tempo=round(60000000/BPM);tracks.append(track([(0,b'\xff\x51\x03'+tempo.to_bytes(3,'big')),(0,b'\xff\x58\x04\x04\x02\x18\x08')]))
for ch,(kind,program) in enumerate([('mallet',12),('pluck',24),('bass',32),('pad',89)]):
 events=[(0,bytes([0xC0+ch,program]))]
 for inst,pitch,onset,length,vel in score:
  if inst!=kind:continue
  start=max(0,round(onset*480));end=min(BEATS*480,round((onset+length)*480));v=min(110,max(30,round(vel*260)))
  events.extend([(start,bytes([0x90+ch,pitch,v])),(end,bytes([0x80+ch,pitch,0]))])
 tracks.append(track(events))
(out/'bucket-garden-loop-v1.mid').write_bytes(b'MThd'+struct.pack('>IHHH',6,1,len(tracks),480)+b''.join(tracks))
info={'title':'桶桶队长的花园 · 初稿','bpm':BPM,'bars':16,'seconds':N/RATE,'key':'C major','instruments':['original modal mallet','plucked strings','soft bass','warm pad','brush percussion'],'peak_dbfs':float(20*np.log10(np.max(np.abs(mix)))),'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(mix**2)))),'boundary_step':float(np.max(np.abs(mix[0]-mix[-1]))),'source':'Original composition and procedural synthesis; no sampled songs.'}
(out/'bucket-garden-loop-v1.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(info,ensure_ascii=False));print(file)
