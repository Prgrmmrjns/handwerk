import bpy, math, json
import numpy as np
from mathutils import Vector, Matrix, Euler
D=bpy.data
def V(o): 
    n=len(o.data.vertices); a=np.zeros(n*3); o.data.vertices.foreach_get('co',a); return a.reshape(-1,3)
def pca(P,ref=None):
    c=P.mean(0); w,v=np.linalg.eigh(np.cov((P-c).T)); d=v[:,-1]
    if ref is not None and np.dot(d,ref-c)<0: d=-d
    return c,d
def sphere(P):
    A=np.c_[2*P,np.ones(len(P))]; b=(P**2).sum(1); x=np.linalg.lstsq(A,b,rcond=None)[0]
    return x[:3], math.sqrt(max(x[3]+x[:3]@x[:3],0))
def end_center(P,d,distal=True,frac=0.18):
    t=(P-P.mean(0))@d; L=t.max()-t.min()
    S=P[t>t.max()-frac*L] if distal else P[t<t.min()+frac*L]
    c,r=sphere(S); cen=S.mean(0)
    w=np.linalg.norm((S-cen)-np.outer((S-cen)@d,d),axis=1).max()
    if r>1.2*w or r<0.2*w:
        tip=(t.max() if distal else t.min())
        c=P.mean(0)+d*(tip-(w*0.7 if distal else -w*0.7))
    return c
P={o.name:V(o) for o in D.objects if o.type=='MESH'}
C={k:v.mean(0) for k,v in P.items()}
F={'1':'Thumb','2':'Index','3':'Middle','4':'Ring','5':'Little'}
J={}  # joint centers
for n in '12345':
    mc=f'Metacarpal_{n}'; pp=f'ProxPhalanx_{n}'; dp=f'DistPhalanx_{n}'
    mp=f'MidPhalanx_{n}' if n!='1' else None
    _,d=pca(P[mc],C[pp]); J[f'CMC{n}']=end_center(P[mc],d,False,0.12); J[f'MCP{n}']=end_center(P[mc],d,True)
    nxt=mp or dp
    _,d=pca(P[pp],C[nxt]); J[f'PIP{n}' if mp else 'IP1']=end_center(P[pp],d,True)
    if mp:
        _,d=pca(P[mp],C[dp]); J[f'DIP{n}']=end_center(P[mp],d,True)
    _,d=pca(P[dp],C[dp]+(C[dp]-C[pp]))
    t=(P[dp]-C[dp])@d; J[f'TIP{n}']=P[dp][t.argmax()]
cz=P['Capitate']; zmin=cz[:,2].min(); h=cz[:,2].max()-zmin
J['MIDCARPAL']=sphere(cz[cz[:,2]<zmin+0.3*h])[0]
J['RADIOCARPAL']=C['Lunate'].copy()
for k,v in J.items(): print(k, np.round(v*1000,1))
json.dump({k:list(map(float,v)) for k,v in J.items()},open('/workspace/hand-blender/joints.json','w'),indent=1)
