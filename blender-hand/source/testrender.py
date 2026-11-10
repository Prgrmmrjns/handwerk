import bpy, sys, math
from mathutils import Vector
scn=bpy.context.scene
scn.render.engine='BLENDER_WORKBENCH'; scn.display.shading.light='STUDIO'; scn.display.shading.color_type='MATERIAL'
scn.render.resolution_x=480; scn.render.resolution_y=480
cam=bpy.data.objects.new('TCam',bpy.data.cameras.new('TCam')); scn.collection.objects.link(cam); scn.camera=cam
cam.data.lens=50
tgt=Vector((0.005,-0.04,0.07))
views={'palmar':Vector((0,-1,0.15)),'radial':Vector((1,-0.15,0.1)),'dorsal':Vector((0,1,0.15)),'ulnar':Vector((-1,-0.2,0.1))}
argv=sys.argv[sys.argv.index('--')+1:]
frames=[int(a) for a in argv[0].split(',')]; vsel=argv[1].split(',')
for f in frames:
    scn.frame_set(f)
    for v in vsel:
        d=views[v].normalized(); cam.location=tgt+d*0.40
        cam.rotation_euler=(-d).to_track_quat('-Z','Y').to_euler()
        scn.render.filepath=f'/workspace/hand-blender/test/f{f:04d}_{v}.png'; bpy.ops.render.render(write_still=True)
