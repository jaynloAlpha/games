"""Import generated discovery artwork and rebuild its browser catalog.
Usage: python scripts/build-bucket-discoveries.py [--import-manifest target/discovery-image-import.json]
The optional manifest is a local list of {asset, source, prompt} records from ImageGen.
"""
from pathlib import Path
import argparse,hashlib,json
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[1];game=root/'games'/'bucket-captain';assets=game/'assets'
parser=argparse.ArgumentParser();parser.add_argument('--import-manifest',type=Path);args=parser.parse_args()
items=json.loads((game/'discovery-items.json').read_text(encoding='utf-8'))
assert len(items)==30 and len({i['asset'] for i in items})==30
if args.import_manifest:
 records=json.loads(args.import_manifest.read_text(encoding='utf-8-sig'));proof=[]
 for record in records:
  key=record['asset'];assert key in {i['asset'] for i in items}
  source=Path(record['source']);im=Image.open(source).convert('RGBA');alpha=im.getchannel('A')
  assert alpha.getextrema()==(0,255),(key,'requires actual transparent alpha')
  bbox=alpha.point(lambda v:255 if v>32 else 0).getbbox();assert bbox
  im=im.crop(bbox);im.thumbnail((464,464),Image.Resampling.LANCZOS)
  canvas=Image.new('RGBA',(512,512));canvas.alpha_composite(im,((512-im.width)//2,(512-im.height)//2))
  canvas.save(assets/f'puzzle-{key}.png',optimize=True)
  proof.append({'asset':key,'tool':'built-in image generation','prompt':record['prompt'],'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'output':f'assets/puzzle-{key}.png'})
 provenance=game/'artwork';provenance.mkdir(exist_ok=True);dest=provenance/'discovery-prompts.json'
 previous=json.loads(dest.read_text(encoding='utf-8')) if dest.exists() else []
 by_id={r['asset']:r for r in previous}
 for r in proof:
  old=by_id.get(r['asset'])
  if old and old['sourceSha256']!=r['sourceSha256']:r['previousPrompts']=old.get('previousPrompts',[])+[old['prompt']]
  by_id[r['asset']]=r
 dest.write_text(json.dumps([by_id[i['asset']] for i in items if i['asset'] in by_id],ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(game/'discovery-items.js').write_text('/* Preschool discoveries: source is discovery-items.json. */\nwindow.BucketDiscoveryItems='+json.dumps(items,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
# A review sheet is produced only once every requested asset is available.
missing=[i['asset'] for i in items if not (assets/f"puzzle-{i['asset']}.png").exists()]
if not missing:
 sheet=Image.new('RGB',(1200,1500),'#fff9e8');draw=ImageDraw.Draw(sheet)
 font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',20)
 for n,item in enumerate(items):
  im=Image.open(assets/f"puzzle-{item['asset']}.png").convert('RGBA');im.thumbnail((215,215),Image.Resampling.LANCZOS);x=n%5*240+(240-im.width)//2;y=n//5*250+6
  sheet.paste(im,(x,y),im);draw.text((n%5*240+120,n//5*250+227),item['name'],font=font,fill='#456c58',anchor='mm')
 out=root/'target'/'bucket-captain-check';out.mkdir(exist_ok=True,parents=True);sheet.save(out/'discovery-contact.png')
print(f"Catalog: {len(items)} discoveries; imported {len(records) if args.import_manifest else 0}; missing artwork: {len(missing)}")
