import bpy
s=bpy.context.scene
bpy.ops.mesh.primitive_monkey_add()
cam=bpy.data.objects.new('c',bpy.data.cameras.new('c')); s.collection.objects.link(cam); cam.location=(0,-4,0); cam.rotation_euler=(1.5708,0,0); s.camera=cam
s.render.engine='BLENDER_EEVEE_NEXT'; s.render.resolution_x=320; s.render.resolution_y=180
s.render.filepath='/tmp/eevee.png'; bpy.ops.render.render(write_still=True)
