import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath="/workspace/hand-blender/SkeletalSystem100.fbx")
for o in bpy.data.objects:
    if o.type=='MESH' and len(o.data.polygons)>6 and o.name.endswith('.r'):
        t=o.matrix_world.translation
        if t.z<0.98 and t.z>0.6: print(repr(o.name), len(o.data.polygons), len(o.data.vertices), tuple(round(v,3) for v in t), [m.name for m in o.data.materials])
