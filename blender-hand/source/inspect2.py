import bpy,re
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath="/workspace/hand-blender/Joints100.fbx")
for o in bpy.data.objects:
    if o.type=='MESH' and len(o.data.polygons)>6:
        t=o.matrix_world.translation
        if t.x<-0.18 and t.z<0.9: print(repr(o.name), len(o.data.polygons), tuple(round(v,3) for v in t))
