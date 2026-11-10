import bpy, math
from mathutils import Vector
D=bpy.data; scn=bpy.context.scene; r=math.radians
FPS=scn.render.fps
CENTER=Vector((0.005,-0.035,0.05))
# world
w=D.worlds.new('DarkStudio'); scn.world=w; w.use_nodes=True
nt=w.node_tree; bg=nt.nodes['Background']
grad=nt.nodes.new('ShaderNodeTexGradient'); grad.gradient_type='SPHERICAL'
tc=nt.nodes.new('ShaderNodeTexCoord'); mp=nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value=(0.6,0.6,0.6)
ramp=nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color=(0.004,0.005,0.008,1); ramp.color_ramp.elements[1].color=(0.03,0.035,0.05,1)
lp=nt.nodes.new('ShaderNodeLightPath'); mix=nt.nodes.new('ShaderNodeMixShader'); bg2=nt.nodes.new('ShaderNodeBackground')
bg2.inputs['Color'].default_value=(0.18,0.2,0.24,1); bg2.inputs['Strength'].default_value=0.35
nt.links.new(tc.outputs['Window'],mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'],grad.inputs['Vector'])
nt.links.new(grad.outputs['Fac'],ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'],bg.inputs['Color'])
mp.inputs['Location'].default_value=(-0.5,-0.5,0)
out=nt.nodes['World Output']
nt.links.new(bg2.outputs[0],mix.inputs[1]); nt.links.new(bg.outputs[0],mix.inputs[2]); nt.links.new(lp.outputs['Is Camera Ray'],mix.inputs['Fac'])
nt.links.new(mix.outputs[0],out.inputs['Surface'])
# orbit rig
orbit=D.objects.new('CamOrbit',None); scn.collection.objects.link(orbit); orbit.location=CENTER; orbit.empty_display_size=0.05
target=D.objects.new('CamTarget',None); scn.collection.objects.link(target); target.location=CENTER+Vector((0,0,0.005))
cam=D.objects.new('Camera',D.cameras.new('Camera')); scn.collection.objects.link(cam); scn.camera=cam
cam.parent=orbit; cam.location=(0,-0.62,0.09); cam.data.lens=40; cam.data.clip_start=0.01
cam.data.dof.use_dof=False; cam.data.dof.focus_object=target; cam.data.dof.aperture_fstop=5.6
tr=cam.constraints.new('TRACK_TO'); tr.target=target; tr.track_axis='TRACK_NEGATIVE_Z'; tr.up_axis='UP_Y'
def area(name,loc,energy,size,color):
    l=D.lights.new(name,'AREA'); l.energy=energy; l.size=size; l.color=color
    o=D.objects.new(name,l); scn.collection.objects.link(o); o.parent=orbit; o.location=loc
    c=o.constraints.new('TRACK_TO'); c.target=target; c.track_axis='TRACK_NEGATIVE_Z'; c.up_axis='UP_Y'
    return o
area('Key',(0.45,-0.45,0.45),24,0.35,(1.0,0.95,0.88))
area('Fill',(-0.55,-0.35,0.05),6,0.6,(0.80,0.88,1.0))
area('Rim',(0.05,0.55,0.35),45,0.25,(0.75,0.85,1.0))
# camera orbit keys (deg about Z; 0=palmar, 90=radial, 180=dorsal)
ORB=[(0,25),(1.5,25),(4.5,55),(6.8,40),(8.0,10),(9.5,10),(11.0,35),(18.5,40),(20.0,75),(31.5,85),(33.0,95),(38.4,95),(39.6,175),(43.0,185),(45.0,215)]
for t,deg in ORB:
    orbit.rotation_euler=(0,0,r(deg)); orbit.keyframe_insert('rotation_euler',index=2,frame=int(round(t*FPS))+1)
# subtle dolly in for the opposition sequence
for t,dist in [(0,0.62),(10.0,0.62),(11.4,0.52),(18.0,0.52),(19.5,0.62),(45,0.62)]:
    cam.location.y=-dist; cam.keyframe_insert('location',index=1,frame=int(round(t*FPS))+1)
# captions (text objects parented to camera)
cmat=D.materials.new('CaptionText'); cmat.use_nodes=True
n=cmat.node_tree.nodes; n.clear(); em=n.new('ShaderNodeEmission'); em.inputs['Color'].default_value=(0.92,0.95,1,1); em.inputs['Strength'].default_value=1.0
o2=n.new('ShaderNodeOutputMaterial'); cmat.node_tree.links.new(em.outputs[0],o2.inputs[0])
amat=D.materials.new('CaptionAccent'); amat.use_nodes=True
n=amat.node_tree.nodes; n.clear(); em=n.new('ShaderNodeEmission'); em.inputs['Color'].default_value=(0.45,0.75,1,1); em.inputs['Strength'].default_value=1.0
o2=n.new('ShaderNodeOutputMaterial'); amat.node_tree.links.new(em.outputs[0],o2.inputs[0])
DZ=-0.3; HW=0.3*18/40; HH=HW*9/16
def text(name,body,x,y,size,mat):
    cu=D.curves.new(name,'FONT'); cu.body=body; cu.size=size; cu.materials.append(mat)
    o=D.objects.new(name,cu); scn.collection.objects.link(o); o.parent=cam; o.location=(x,y,DZ)
    return o
text('Title','Healthy right hand  -  bones & joints in motion',-HW+0.008,HH-0.014,0.0062,amat)
text('Subtitle','Z-Anatomy / BodyParts3D meshes (CC BY-SA)  |  textbook healthy ranges',-HW+0.008,HH-0.0215,0.0036,cmat)
marks=sorted(scn.timeline_markers,key=lambda m:m.frame)
for i,m in enumerate(marks):
    o=text(f'Cap_{i:02d}',m.name,-HW+0.008,-HH+0.010,0.0072,cmat)
    end=marks[i+1].frame if i+1<len(marks) else scn.frame_end+1
    for f,h in [(1,True),(m.frame,False),(end,True)]:
        o.hide_render=h; o.hide_viewport=h; o.keyframe_insert('hide_render',frame=f); o.keyframe_insert('hide_viewport',frame=f)
    for fc in o.animation_data.action.fcurves:
        for k in fc.keyframe_points: k.interpolation='CONSTANT'
# render settings
scn.render.engine='BLENDER_EEVEE_NEXT'
e=scn.eevee; e.taa_render_samples=16
for a,v in [('use_shadows',True),('use_raytracing',False),('use_gtao',True),('gtao_distance',0.05)]:
    if hasattr(e,a): setattr(e,a,v)
scn.view_settings.view_transform='AgX'; scn.view_settings.look='AgX - Medium High Contrast'
scn.render.resolution_x=1280; scn.render.resolution_y=720; scn.render.resolution_percentage=100
scn.render.image_settings.file_format='PNG'
scn.render.filepath='/workspace/hand-blender/frames/f_'
for o in D.objects:
    if o.type=='MESH': o.data.materials and None
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath='/workspace/hand-blender/hand_skeleton.blend',compress=True)
print('saved final', scn.frame_start, scn.frame_end, len(marks))
