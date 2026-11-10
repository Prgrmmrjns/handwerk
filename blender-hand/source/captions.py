# retime caption visibility: each caption appears when the motion toward its pose starts; render caption-only plates
import bpy, sys
D=bpy.data; scn=bpy.context.scene
SEQ_T=[0,1.2,2.0,2.6,4.2,5.4,6.8,8.0,9.0,10.2,11.4,12.2,13.2,14.0,15.0,15.8,16.9,17.9,19.1,20.2,20.8,22.0,23.0,24.2,25.2,26.6,27.6,28.9,29.9,31.2,31.8,32.6,34.0,34.8,36.6,37.4,38.6,39.8,40.5,42.0,42.7,44.0,45.0]
FR=[int(round(t*30))+1 for t in SEQ_T]
marks=sorted(scn.timeline_markers,key=lambda m:m.frame)
starts=[]
for i,m in enumerate(marks):
    j=FR.index(m.frame); starts.append(1 if j==0 else FR[j-1])
sched=[]
for i,m in enumerate(marks):
    o=D.objects[f'Cap_{i:02d}']; s=starts[i]; e=starts[i+1] if i+1<len(marks) else scn.frame_end+1
    o.animation_data_clear()
    for f,h in [(1,True),(s,False),(e,True)]:
        o.hide_render=h; o.hide_viewport=h; o.keyframe_insert('hide_render',frame=f); o.keyframe_insert('hide_viewport',frame=f)
    for fc in o.animation_data.action.fcurves:
        for k in fc.keyframe_points: k.interpolation='CONSTANT'
    sched.append((m.name,s,e-1,m.frame))
import json; json.dump(sched,open('/workspace/hand-blender/captions.json','w'),indent=1)
bpy.ops.wm.save_as_mainfile(filepath='/workspace/hand-blender/hand_skeleton.blend',compress=True)
# plates: hide meshes, each caption alone
for o in D.objects:
    if o.type=='MESH': o.hide_render=True
caps=[D.objects[f'Cap_{i:02d}'] for i in range(len(marks))]
for c in caps: c.animation_data_clear()
scn.frame_set(1)
for i in range(len(marks)+1):
    for j,c in enumerate(caps): c.hide_render=(j!=i)
    scn.render.filepath=f'/workspace/hand-blender/test2/plate_{i:02d}.png'; bpy.ops.render.render(write_still=True)
print('SCHED',sched)
