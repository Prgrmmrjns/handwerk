import bpy, math, json, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
scn=bpy.context.scene; D=bpy.data; r=math.radians
orbit=D.objects['CamOrbit']; cam=D.objects['Camera']
orbit.animation_data_clear(); cam.animation_data_clear()
for o in D.objects:
    if o.name.startswith(('Cap_','Subtitle','Title')):
        o.animation_data_clear(); o.hide_render=True
scn.render.resolution_x=1920; scn.render.resolution_y=1080; scn.eevee.taa_render_samples=48
V=[('palmar',61,0,0.60,0.06),('dorsal',61,180,0.60,0.06),('radial_lateral',1,90,0.60,0.09),('threequarter_fist',127,40,0.50,0.09),('threequarter_opposition',397,30,0.50,0.10)]
sel=sys.argv[sys.argv.index('--')+1].split(',') if '--' in sys.argv else [v[0] for v in V]
out={}
for name,fr,th,dist,elev in V:
    if name not in sel: continue
    scn.frame_set(fr); orbit.rotation_euler=(0,0,r(th)); cam.location=(0,-dist,elev)
    bpy.context.view_layer.update()
    dg=bpy.context.evaluated_depsgraph_get(); pts={}
    for o in D.objects:
        if o.type!='MESH': continue
        ev=o.evaluated_get(dg); me=ev.to_mesh()
        c=sum((ev.matrix_world@v.co for v in me.vertices),Vector())/len(me.vertices); ev.to_mesh_clear()
        p=world_to_camera_view(scn,cam,c); pts[o.name]=[p.x,1-p.y,p.z]
    out[name]=pts
    scn.render.filepath=f'/workspace/hand-blender/stills/{name}.png'; bpy.ops.render.render(write_still=True)
old={}
try: old=json.load(open('/workspace/hand-blender/stills/proj.json'))
except Exception: pass
old.update(out); json.dump(old,open('/workspace/hand-blender/stills/proj.json','w'),indent=1)
