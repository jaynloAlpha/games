"""Build static dashed puzzle outlines from alpha silhouettes and registered layouts.
Authoring-only dependencies: Pillow, NumPy, scikit-image, SciPy. No browser runtime dependency.
"""
from pathlib import Path
import json,sys
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage import measure
root=Path(__file__).resolve().parents[1]/'games'/'bucket-captain';assets=root/'assets'
layouts=json.loads((root/'puzzle-layouts.json').read_text(encoding='utf-8'))
animals=json.loads((root/'safari-animals.json').read_text(encoding='utf-8'))
lookup={item['asset']:item['layout'] for item in animals}
for file in sorted(assets.glob('puzzle-*.png')):
 name=file.stem[7:];dest=assets/('outline-'+name+'.svg')
 if dest.exists() and '--force' not in sys.argv:continue
 im=Image.open(file).convert('RGBA');w,h=im.size;mask=ndimage.binary_closing(np.array(im.getchannel('A'))>100,iterations=1);paths=[]
 for c in measure.find_contours(np.pad(mask,1),.5):
  area=abs(np.dot(c[:,1],np.roll(c[:,0],1))-np.dot(c[:,0],np.roll(c[:,1],1)))/2
  if area<60:continue
  c=measure.approximate_polygon(c,tolerance=1.0);paths.append('M'+' L'.join(f'{(x-1)/w*512:.1f},{(y-1)/h*512:.1f}' for y,x in c)+'Z')
 d=' '.join(paths);piece_paths=[]
 for poly in layouts[lookup.get(name,'legacy')]['polygons']:
  piece_paths.append('M'+' L'.join(f'{x*512:.1f},{y*512:.1f}' for x,y in poly)+'Z')
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><clipPath id="silhouette"><path d="{d}" clip-rule="evenodd"/></clipPath></defs><path d="{d}" fill="none" stroke="#547c60" stroke-width="3" stroke-dasharray="9 7" stroke-linecap="round" stroke-linejoin="round"/><g clip-path="url(#silhouette)" fill="none" stroke="#759975" stroke-width="2.5" stroke-dasharray="7 7"><path d="'+ ' '.join(piece_paths) +'"/></g></svg>'
 dest.write_text(svg,encoding='utf-8');print(name,len(piece_paths),'pieces')
