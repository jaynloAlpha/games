"""Author a small, repeatable clay/wood snap sound palette (not a runtime dependency)."""
from pathlib import Path
import wave
import numpy as np
from scipy.signal import butter,sosfilt
root=Path(__file__).resolve().parents[1]/'games'/'bucket-captain'/'assets';rate=44100
rng=np.random.default_rng(418)
def tone(t,f,decay):return np.sin(2*np.pi*f*t)*np.exp(-t/decay)
def add(output,onset,signal):
 start=round(onset*rate);end=min(len(output),start+len(signal));output[start:end]+=signal[:end-start]
def save(name,x):
 x=np.tanh(x*1.35);peak=float(np.max(np.abs(x)));x=x*(.87/max(peak,1e-8));x[-round(rate*.018):]*=np.linspace(1,0,round(rate*.018));pcm=np.rint(x*32767).astype('<i2')
 with wave.open(str(root/name),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
 print(name,'duration',round(len(x)/rate,3),'peak',round(float(np.max(np.abs(x))),3),'rms',round(float(np.sqrt(np.mean(x*x))),3))
for index,ratio in enumerate([1,1.12246,1.25992],1):
 t=np.arange(round(.32*rate))/rate;x=np.zeros_like(t)
 # Soft material contact: a low wooden body, with midrange audible on tablet speakers.
 body=.44*tone(t,240*ratio,.027)+.42*tone(t,610*ratio,.021)+.2*tone(t,1320*ratio,.014)
 noise=sosfilt(butter(2,[1000,4900],btype='bandpass',fs=rate,output='sos'),rng.normal(0,1,len(t)))
 body+=noise*.18*np.exp(-t/.010);body*=np.minimum(1,t/.0015)
 add(x,0,body)
 # Distinct locking click 48 ms later, followed by a short rounded glint.
 lock=.36*tone(t,390*ratio,.037)+.32*tone(t,1180*ratio,.026)+.10*tone(t,2350*ratio,.012)
 lock+=noise*.13*np.exp(-t/.007);lock*=np.minimum(1,t/.001)
 add(x,.048,lock)
 glint=(.12*tone(t,1046.5*ratio,.065)+.055*tone(t,2093*ratio,.035))*np.minimum(1,t/.006)
 add(x,.085,glint);save('snap-seat-'+str(index)+'.wav',x)
t=np.arange(round(.39*rate))/rate;x=np.zeros_like(t)
for onset,f in [(0,1046.5),(.075,1318.5),(.15,1568)]:
 tt=np.arange(round(.21*rate))/rate;envelope=np.minimum(1,tt/.007)*np.exp(-tt/.068)
 add(x,onset,(.28*np.sin(2*np.pi*f*tt)+.065*np.sin(2*np.pi*2*f*tt))*envelope)
save('snap-complete.wav',x)
