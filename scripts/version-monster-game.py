from pathlib import Path
import re,hashlib
r=Path('games/whack-a-mole');p=(r/'index.html').read_text(encoding='utf-8');v=hashlib.sha256((r/'game.css').read_bytes()+(r/'game.js').read_bytes()).hexdigest()[:12]
p=re.sub(r'game\.(css|js)(?:\?v=[^"\s]+)?',lambda m:'game.'+m[1]+'?v='+v,p);(r/'index.html').write_text(p,encoding='utf-8');print(v)
