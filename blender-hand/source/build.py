import bpy, math, json, random, os
import numpy as np
from mathutils import Vector, Matrix, Euler
D=bpy.data; scn=bpy.context.scene
J={k:Vector(v) for k,v in json.load(open('/workspace/hand-blender/joints.json')).items()}
FN={'1':'Thumb','2':'Index','3':'Middle','4':'Ring','5':'Little'}
PALM=Vector((0,-1,0)); THUMBPAD=Vector((-0.8,-0.6,0)).normalized()
# ---------- materials ----------
def principled(name,base,rough,sss=0.0,coat=0.0,spec=0.5):
    m=D.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*base,1); b.inputs['Roughness'].default_value=rough
    b.inputs['Subsurface Weight'].default_value=sss; b.inputs['Subsurface Radius'].default_value=(0.004,0.003,0.002)
    b.inputs['Subsurface Scale'].default_value=0.5
    b.inputs['Coat Weight'].default_value=coat; b.inputs['Specular IOR Level'].default_value=spec
    return m
# bone: off-white ivory with a subtle noise variation via bump
mb=principled('Bone',(0.86,0.80,0.68),0.48,sss=0.12)
nt=mb.node_tree; bsdf=nt.nodes['Principled BSDF']
noise=nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=900; noise.inputs['Detail'].default_value=6
bump=nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=0.08; bump.inputs['Distance'].default_value=0.0003
nt.links.new(noise.outputs['Fac'],bump.inputs['Height']); nt.links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
mix=nt.nodes.new('ShaderNodeMixRGB'); mix.inputs['Color1'].default_value=(0.60,0.50,0.36,1); mix.inputs['Color2'].default_value=(0.74,0.66,0.52,1)
n2=nt.nodes.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value=120
nt.links.new(n2.outputs['Fac'],mix.inputs['Fac']); nt.links.new(mix.outputs['Color'],bsdf.inputs['Base Color'])
mc=principled('Cartilage',(0.45,0.66,0.85),0.22,sss=0.25,coat=0.4)
for o in D.objects:
    if o.type=='MESH':
        for i,s in enumerate(o.material_slots):
            s.material = mc if s.material and s.material.name.startswith('Cartilage') else mb
        if not any(m.type=='SUBSURF' for m in o.modifiers):
            sm=o.modifiers.new('Smooth','SUBSURF'); sm.levels=1; sm.render_levels=2
for m in list(D.materials):
    if m.users==0: D.materials.remove(m)
# ---------- armature ----------
ad=D.armatures.new('HandRig'); arm=D.objects.new('HandRig',ad); scn.collection.objects.link(arm)
ad.display_type='OCTAHEDRAL'; arm.show_in_front=True; arm.hide_render=True
bpy.context.view_layer.objects.active=arm; bpy.ops.object.mode_set(mode='EDIT')
B={}
def mk(name,head,tail,parent=None,roll=PALM):
    e=ad.edit_bones.new(name); e.head=head; e.tail=tail
    if parent: e.parent=ad.edit_bones[parent]; e.use_connect=False
    e.align_roll(roll); B[name]=e; return e
mk('Forearm',Vector((-0.006,0.012,-0.085)),J['RADIOCARPAL']+Vector((0,0,-0.004)))
mk('Wrist_Radiocarpal',J['RADIOCARPAL'],J['RADIOCARPAL']+Vector((0,0,0.012)),'Forearm')
mk('Wrist_Midcarpal',J['MIDCARPAL'],J['CMC3'],'Wrist_Radiocarpal')
for n in '2345':
    f=FN[n]
    mk(f'{f}_CMC',J[f'CMC{n}'],J[f'MCP{n}'],'Wrist_Midcarpal')
    mk(f'{f}_MCP',J[f'MCP{n}'],J[f'PIP{n}'],f'{f}_CMC')
    mk(f'{f}_PIP',J[f'PIP{n}'],J[f'DIP{n}'],f'{f}_MCP')
    mk(f'{f}_DIP',J[f'DIP{n}'],J[f'TIP{n}'],f'{f}_PIP')
mk('Thumb_CMC',J['CMC1'],J['MCP1'],'Wrist_Midcarpal',THUMBPAD)
mk('Thumb_MCP',J['MCP1'],J['IP1'],'Thumb_CMC',THUMBPAD)
mk('Thumb_IP',J['IP1'],J['TIP1'],'Thumb_MCP',THUMBPAD)
bpy.ops.object.mode_set(mode='OBJECT')
# ---------- parent meshes rigidly ----------
PAR={'Radius':'Forearm','Ulna':'Forearm'}
for c in ['Scaphoid','Lunate','Triquetrum','Pisiform']: PAR[c]='Wrist_Radiocarpal'
for c in ['Trapezium','Trapezoid','Capitate','Hamate']: PAR[c]='Wrist_Midcarpal'
for n in '12345':
    f=FN[n]; PAR[f'Metacarpal_{n}']=f'{f}_CMC'
    PAR[f'ProxPhalanx_{n}']=f'{f}_MCP'
    if n!='1': PAR[f'MidPhalanx_{n}']=f'{f}_PIP'
    PAR[f'DistPhalanx_{n}']= 'Thumb_IP' if n=='1' else f'{f}_DIP'
for o,b in PAR.items():
    ob=D.objects[o]; mw=ob.matrix_world.copy()
    ob.parent=arm; ob.parent_type='BONE'; ob.parent_bone=b
    bone=ad.bones[b]
    ob.matrix_parent_inverse=(Matrix.Translation(bone.tail_local) @ bone.matrix_local.to_3x3().to_4x4()).inverted()
    ob.matrix_world=mw
bpy.context.view_layer.update()
for pb in arm.pose.bones: pb.rotation_mode='XYZ'
# ---------- anatomical helpers ----------
bones=ad.bones
def axes(b): m=bones[b].matrix_local.to_3x3(); return m.col[0],m.col[1],m.col[2]
REST={}
for b in bones:
    REST[b.name]=0.0
    if b.parent and any(b.name.endswith(s) for s in ['_MCP','_PIP','_DIP','_IP']):
        px,py,pz=axes(b.parent.name); cy=axes(b.name)[1]
        REST[b.name]=math.degrees(math.atan2(cy.dot(pz),cy.dot(py)))
RAD={b.name:(1 if axes(b.name)[0].x<0 else -1) for b in bones}  # +Z rot sign moving toward radial (+X world)
print('REST flex', {k:round(v,1) for k,v in REST.items()})
r=math.radians
def rot(b,flex=None,radial=0.0,axial=0.0):
    """anatomical: flex deg from straight (None=keep rest), radial deg (+toward thumb), axial deg"""
    fx=0.0 if flex is None else r(flex-REST[b])
    return (fx, r(axial), RAD[b]*r(radial))
JOINTS=[b.name for b in bones if b.name!='Forearm']
def pose_dict(**kw):
    d={b:(0.0,0.0,0.0) for b in JOINTS}
    for k,v in kw.items():
        if isinstance(v,dict): d[k]=rot(k,**v)
        else: d[k]=v
    return d
def fingers(mcp,pip,dip,cmc45=False,abd=None,which='2345'):
    d={}
    for n in which:
        f=FN[n]; a=(abd or {}).get(n,0)
        d[f'{f}_MCP']={'flex':mcp if not isinstance(mcp,dict) else mcp[n],'radial':a}
        d[f'{f}_PIP']={'flex':pip if not isinstance(pip,dict) else pip[n]}
        d[f'{f}_DIP']={'flex':dip if not isinstance(dip,dict) else dip[n]}
    if cmc45:
        d['Ring_CMC']={'flex':cmc45*0.5}; d['Little_CMC']={'flex':cmc45}
    return d
def apply(d):
    for b,(x,y,z) in d.items(): arm.pose.bones[b].rotation_euler=(x,y,z)
def wpt(b,p_rest):
    pb=arm.pose.bones[b]; return pb.matrix @ bones[b].matrix_local.inverted() @ p_rest
def pad_point(mesh,bname,dirz):
    ob=D.objects[mesh]; X,Y,Z=axes(bname); w=(Y+0.55*dirz).normalized()
    vs=[ob.matrix_world@v.co for v in ob.data.vertices]
    return max(vs,key=lambda p:p.dot(w))
PADS={n:pad_point(f'DistPhalanx_{n}','Thumb_IP' if n=='1' else f'{FN[n]}_DIP', THUMBPAD if n=='1' else axes(f'{FN[n]}_DIP')[2]) for n in '12345'}
THUMB=['Thumb_CMC','Thumb_MCP','Thumb_IP']
LIM={'cx':(-30,75),'cy':(-60,60),'cz':(-75,75),'m':(0,55),'i':(-10,80)}
def thumb_from(p):
    cx,cy,cz,m,i=p
    return {'Thumb_CMC':(r(cx),r(cy),r(cz)),'Thumb_MCP':rot('Thumb_MCP',flex=m),'Thumb_IP':rot('Thumb_IP',flex=i)}
def solve_thumb(target_fn, gap, face_fn, seed=1, iters=1600, x0=(10,10,20,20,20)):
    rnd=random.Random(seed); keys=['cx','cy','cz','m','i']
    def cost(p):
        apply(thumb_from(p)); bpy.context.view_layer.update()
        tp=wpt('Thumb_IP',PADS['1']); tgt=target_fn()
        c=((tp-tgt).length-gap)**2*1e6
        tz=(arm.pose.bones['Thumb_IP'].matrix.to_3x3()@Vector((0,0,1)))
        c+=0.6*(1+tz.dot(face_fn()))
        c+=0.15*sum((v/60)**2 for v in p)
        return c
    gb,gc=None,1e18
    starts=[list(x0)]+[[rnd.uniform(*LIM[k]) for k in keys] for _ in range(11)]
    for st in starts:
        best=[min(max(st[j],LIM[keys[j]][0]),LIM[keys[j]][1]) for j in range(5)]; bc=cost(best); step=20
        for it in range(700):
            cand=[min(max(best[j]+rnd.gauss(0,step),LIM[keys[j]][0]),LIM[keys[j]][1]) for j in range(5)]
            cc=cost(cand)
            if cc<bc: best,bc=cand,cc
            if it%100==99: step*=0.65
        if bc<gc: gb,gc=best,bc
    best,bc=gb,gc
    apply(thumb_from(best)); bpy.context.view_layer.update()
    print('thumb solve',[round(v,1) for v in best],'cost',round(bc,3),'dist mm',round((wpt('Thumb_IP',PADS['1'])-target_fn()).length*1000,1))
    return thumb_from(best)
# ---------- poses ----------
def centroid_rest(mesh):
    ob=D.objects[mesh]; return sum((ob.matrix_world@v.co for v in ob.data.vertices),Vector())/len(ob.data.vertices)
CR={o.name:centroid_rest(o.name) for o in D.objects if o.type=='MESH'}
def zaxis(b): return arm.pose.bones[b].matrix.to_3x3()@Vector((0,0,1))
STRAIGHT=fingers(0,0,0)
THUMB_STRAIGHT={'Thumb_MCP':{'flex':0},'Thumb_IP':{'flex':0}}
P={}
P['rest']=pose_dict()
P['straight']=pose_dict(**STRAIGHT,**THUMB_STRAIGHT)
# full fist with thumb wrapped over middle phalanges of index/middle
fist=pose_dict(**fingers(90,105,75,cmc45=20))
apply(fist); bpy.context.view_layer.update()
def fist_target():
    c=(wpt('Index_PIP',CR['MidPhalanx_2'])+wpt('Middle_PIP',CR['MidPhalanx_3']))/2
    return c-zaxis('Index_PIP')*0.009
fist.update(solve_thumb(fist_target,0.0,lambda:-zaxis('Index_PIP'),seed=3,x0=(30,10,10,45,30)))
P['fist']=fist
P['spread']=pose_dict(**fingers(0,0,0,abd={'2':20,'3':0,'4':-15,'5':-28}),Thumb_CMC=(r(-25),0,0),**THUMB_STRAIGHT)
OPP={'2':(50,65,30),'3':(55,68,32),'4':(60,70,32),'5':(65,70,32)}
for n,(m,p,dd) in OPP.items():
    f=FN[n]; d=pose_dict(**fingers(m,p,dd,which=n))
    if n=='5': d['Little_CMC']=rot('Little_CMC',flex=18); d['Ring_CMC']=rot('Ring_CMC',flex=6)
    if n=='4': d['Little_CMC']=rot('Little_CMC',flex=8)
    apply(d); bpy.context.view_layer.update()
    tf=lambda n=n,f=f: wpt(f'{f}_DIP',PADS[n]); ff=lambda f=f: zaxis(f'{f}_DIP')
    d.update(solve_thumb(tf,0.011,ff,seed=int(n),x0=(30,20,20,20,20)))
    P['opp'+n]=d
P['hook']=pose_dict(**fingers(0,100,80),**THUMB_STRAIGHT)
P['tabletop']=pose_dict(**fingers(90,0,0),**THUMB_STRAIGHT)
P['straightfist']=pose_dict(**fingers(90,100,0),**THUMB_STRAIGHT)
P['tg_fist']=fist
def wrist(rc_flex=0,mc_flex=0,rc_rad=0,mc_rad=0):
    return pose_dict(Wrist_Radiocarpal={'flex':rc_flex,'radial':rc_rad},Wrist_Midcarpal={'flex':mc_flex,'radial':mc_rad})
P['wflex']=wrist(35,45); P['wext']=wrist(-45,-25); P['rdev']=wrist(0,0,8,12); P['udev']=wrist(0,0,-15,-15)
# ---------- timeline (seconds) ----------
FPS=30
SEQ=[(0,'rest','Rest (relaxed hand)'),(1.2,'rest',None),(2.0,'straight','Fingers straight'),(2.6,'straight',None),
 (4.2,'fist','Full fist'),(5.4,'fist',None),(6.8,'straight',None),
 (8.0,'spread','Finger spread (abduction)'),(9.0,'spread',None),(10.2,'rest',None),
 (11.4,'opp2','Thumb opposition: index'),(12.2,'opp2',None),(13.2,'opp3','Thumb opposition: middle'),(14.0,'opp3',None),
 (15.0,'opp4','Thumb opposition: ring'),(15.8,'opp4',None),(16.9,'opp5','Thumb opposition: little'),(17.9,'opp5',None),(19.1,'rest',None),
 (20.2,'straight','Tendon gliding: straight'),(20.8,'straight',None),(22.0,'hook','Tendon gliding: hook fist'),(23.0,'hook',None),
 (24.2,'tg_fist','Tendon gliding: full fist'),(25.2,'tg_fist',None),(26.6,'tabletop','Tendon gliding: tabletop'),(27.6,'tabletop',None),
 (28.9,'straightfist','Tendon gliding: straight fist'),(29.9,'straightfist',None),(31.2,'straight','Tendon gliding: straight'),(31.8,'straight',None),
 (32.6,'rest',None),(34.0,'wflex','Wrist flexion 80°'),(34.8,'wflex',None),(36.6,'wext','Wrist extension 70°'),(37.4,'wext',None),(38.6,'rest',None),
 (39.8,'rdev','Radial deviation 20°'),(40.5,'rdev',None),(42.0,'udev','Ulnar deviation 30°'),(42.7,'udev',None),(44.0,'rest','Back to rest'),(45.0,'rest',None)]
scn.render.fps=FPS; scn.frame_start=1; scn.frame_end=int(45.0*FPS)+1
for t,name,label in SEQ:
    fr=int(round(t*FPS))+1
    apply(P[name])
    for b in JOINTS: arm.pose.bones[b].keyframe_insert('rotation_euler',frame=fr)
    if label: scn.timeline_markers.new(label,frame=fr)
for fc in arm.animation_data.action.fcurves:
    for k in fc.keyframe_points: k.interpolation='BEZIER'; k.easing='AUTO'; k.handle_left_type=k.handle_right_type='AUTO_CLAMPED'
arm.animation_data.action.name='HealthyHandMotion'
# store the named poses as a pose library-ish: actions per pose not needed; save poses json
json.dump({k:{b:list(v) for b,v in d.items()} for k,d in P.items()},open('/workspace/hand-blender/poses.json','w'))
# limit rotation constraints (healthy range, relative to model rest) for manual posing
RANGE={'_MCP':(-20,90),'_PIP':(0,110),'_DIP':(-5,80)}
for pb in arm.pose.bones:
    for suf,(lo,hi) in RANGE.items():
        if pb.name.endswith(suf) and not pb.name.startswith('Thumb'):
            c=pb.constraints.new('LIMIT_ROTATION'); c.owner_space='LOCAL'; c.use_limit_x=True
            c.min_x=r(lo-REST[pb.name]); c.max_x=r(hi-REST[pb.name]); c.use_limit_y=True; c.min_y=c.max_y=0
            if suf=='_MCP': c.use_limit_z=True; c.min_z=r(-30); c.max_z=r(30)
            else: c.use_limit_z=True; c.min_z=c.max_z=0
            c.use_transform_limit=True
    if pb.name in ('Thumb_MCP','Thumb_IP'):
        lo,hi=(0,55) if pb.name=='Thumb_MCP' else (-10,80)
        c=pb.constraints.new('LIMIT_ROTATION'); c.owner_space='LOCAL'; c.use_limit_x=True
        c.min_x=r(lo-REST[pb.name]); c.max_x=r(hi-REST[pb.name]); c.use_transform_limit=True
scn.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath='/workspace/hand-blender/hand_rig_stage.blend')
print('saved stage')
