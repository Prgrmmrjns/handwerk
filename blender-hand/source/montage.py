from PIL import Image, ImageDraw
import glob,sys
fs=sorted(glob.glob('/workspace/hand-blender/test/f*_*.png'))
frames=sorted(set(f.split('/')[-1][1:5] for f in fs)); views=sorted(set(f.split('_')[-1][:-4] for f in fs))
S=int(sys.argv[1]) if len(sys.argv)>1 else 400
W=Image.new('RGB',(S*len(frames),S*len(views)))
for i,fr in enumerate(frames):
    for j,v in enumerate(views):
        try: W.paste(Image.open(f'/workspace/hand-blender/test/f{fr}_{v}.png').convert('RGB').resize((S,S)),(i*S,j*S))
        except: pass
        ImageDraw.Draw(W).text((i*S+10,j*S+10),f'{fr} {v}',fill=(255,0,0))
W.save('/workspace/hand-blender/test/montage.png')
