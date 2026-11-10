import json, sys
from PIL import Image, ImageDraw, ImageFont
P=json.load(open('/workspace/hand-blender/stills/proj.json'))
F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',22)
FB=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',30)
FN={'1':'thumb','2':'index','3':'middle','4':'ring','5':'little'}
def nice(n):
    for k,v in [('Metacarpal_','Metacarpal'),('ProxPhalanx_','Proximal phalanx'),('MidPhalanx_','Middle phalanx'),('DistPhalanx_','Distal phalanx')]:
        if n.startswith(k):
            d=n[-1]; return f'{v} ({FN[d]})' if not k.startswith('Meta') else f'{v} {["I","II","III","IV","V"][int(d)-1]} ({FN[d]})'
    return n
for view in sys.argv[1:]:
    im=Image.open(f'/workspace/hand-blender/stills/{view}.png').convert('RGB'); W,H=im.size
    dr=ImageDraw.Draw(im); pts={k:(v[0]*W,v[1]*H) for k,v in P[view].items()}
    cx=sorted(p[0] for p in pts.values())[len(pts)//2]
    for side in (0,1):
        items=sorted([(k,p) for k,p in pts.items() if (p[0]<cx)==(side==0) or (p[0]==cx and side==1)],key=lambda kp:kp[1][1])
        if not items: continue
        top,bot=90,H-40; step=(bot-top)/max(len(items),1)
        for i,(k,(x,y)) in enumerate(items):
            ly=top+step*(i+0.5); lx=W*0.30 if side==0 else W*0.70
            tx=lx-8 if side==0 else lx+8
            dr.line([(x,y),(lx,ly)],fill=(120,180,235),width=2)
            dr.ellipse([x-4,y-4,x+4,y+4],fill=(120,200,255))
            t=nice(k); w=dr.textlength(t,font=F)
            dr.text((tx-w if side==0 else tx, ly-13),t,font=F,fill=(230,236,245))
    dr.text((30,24),f'Right hand skeleton - {view.replace("_"," ")} view',font=FB,fill=(140,195,245))
    im.save(f'/workspace/hand-blender/stills/{view}_labeled.png')
print('ok')
