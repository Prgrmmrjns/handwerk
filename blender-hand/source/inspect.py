import bpy,re
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath="/workspace/hand-blender/SkeletalSystem100.fbx")
pat=re.compile(r"scaph|lunat|triquet|pisif|trapez|capitat|hamat|metacarp|phalan|radius|ulna|sesamoid|hand|carp|finger|thumb",re.I)
tot=0
for o in bpy.data.objects:
    if o.type=='MESH': tot+=1
    if pat.search(o.name):
        print(repr(o.name), o.type, len(o.data.polygons) if o.type=='MESH' else '', tuple(round(v,3) for v in o.matrix_world.translation), o.parent.name if o.parent else None)
print("total meshes",tot, "objects",len(bpy.data.objects))
