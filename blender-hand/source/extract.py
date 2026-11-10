import bpy, bmesh, math
from mathutils import Matrix, Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath="/workspace/hand-blender/SkeletalSystem100.fbx")
ords=['first','second','third','fourth','fifth']
names={'Radius.r':'Radius','Ulna.r':'Ulna'}
for c in ['Scaphoid','Lunate','Triquetrum','Pisiform','Trapezium','Trapezoid','Capitate','Hamate']:
    names[f'{c} bone.r']=c
ordn={'first':'1','second':'2','third':'3','fourth':'4','fifth':'5'}
for o in ords:
    names[f'{o.capitalize()} metacarpal bone.r']=f'Metacarpal_{ordn[o]}'
    names[f'Proximal phalanx of {o} finger of hand.r']=f'ProxPhalanx_{ordn[o]}'
    if o!='first': names[f'Middle phalanx of {o} finger of hand.r']=f'MidPhalanx_{ordn[o]}'
    names[f'Distal phalanx of {o} finger of hand.r']=f'DistPhalanx_{ordn[o]}'
keep=[]
for src,dst in names.items():
    ob=bpy.data.objects[src]
    mw=ob.matrix_world.copy()
    ob.parent=None; ob.matrix_world=mw
    keep.append(ob)
for ob in list(bpy.data.objects):
    if ob not in keep: bpy.data.objects.remove(ob, do_unlink=True)
# rotate 180 about Y so fingers point +Z, palm faces -Y, thumb +X
R=Matrix.Rotation(math.pi,4,'Y')
for ob in keep:
    ob.data=ob.data.copy()
    ob.data.transform(R@ob.matrix_world)
    ob.matrix_world=Matrix.Identity(4)
    ob.name=names[[k for k in names if names[k]==ob.name or k==ob.name][0]] if ob.name in names else ob.name
for src,dst in names.items():
    ob=bpy.data.objects.get(src)
    if ob: ob.name=dst; ob.data.name=dst
# center on capitate centroid
cap=bpy.data.objects['Capitate']
c=sum((v.co for v in cap.data.vertices),Vector())/len(cap.data.vertices)
for ob in keep: ob.data.transform(Matrix.Translation(-c))
# cut radius/ulna: keep distal 10 cm (z > -0.10)
for n in ['Radius','Ulna']:
    me=bpy.data.objects[n].data
    bm=bmesh.new(); bm.from_mesh(me)
    geom=bm.verts[:]+bm.edges[:]+bm.faces[:]
    res=bmesh.ops.bisect_plane(bm,geom=geom,plane_co=(0,0,-0.10),plane_no=(0,0,1),clear_inner=True)
    edges=[e for e in res['geom_cut'] if isinstance(e,bmesh.types.BMEdge)]
    bmesh.ops.holes_fill(bm,edges=edges,sides=0)
    bm.to_mesh(me); bm.free()
for ob in keep:
    ob.data.polygons.foreach_set('use_smooth',[True]*len(ob.data.polygons))
    bb=[v.co for v in ob.data.vertices]
    print(ob.name, len(ob.data.polygons), [m.name for m in ob.data.materials], tuple(round(min(v[i] for v in bb),3) for i in range(3)), tuple(round(max(v[i] for v in bb),3) for i in range(3)))
bpy.ops.wm.save_as_mainfile(filepath="/workspace/hand-blender/hand_base.blend")
