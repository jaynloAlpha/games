import json
from pathlib import Path
layouts=json.loads(Path('games/bucket-captain/puzzle-layouts.json').read_text(encoding='utf-8'))
def inside(x,y,poly):
 result=False;j=len(poly)-1
 for i in range(len(poly)):
  a,b=poly[i],poly[j]
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:result=not result
  j=i
 return result
for name,data in layouts.items():
 for ix in range(99):
  for iy in range(101):
   x=(ix+.317)/99;y=(iy+.219)/101
   count=sum(inside(x,y,p) for p in data['polygons'])
   assert count==1,(name,x,y,count)
 for c,p in zip(data['centers'],data['polygons']):assert inside(c[0],c[1],p),(name,c)
 print(name,len(data['polygons']),'pieces: no gaps/overlaps; snap centers valid')
