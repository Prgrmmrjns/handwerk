import bpy,re
pat=re.compile(r"(scaph|lunat|triquet|pisif|trapez|capitat|hamat|metacarp|phalan|radius|ulna|sesamoid)",re.I)
print("SCENES",[s.name for s in bpy.data.scenes])
print("ARMATURES",[(a.name,len(a.bones)) for a in bpy.data.armatures])
for o in bpy.data.objects:
    if o.type=='MESH' and pat.search(o.name) and len(o.data.polygons)>20:
        t=o.matrix_world.translation
        print(repr(o.name), len(o.data.polygons), tuple(round(v,3) for v in t), o.parent.name if o.parent else None, o.parent_type, [m.type for m in o.modifiers])
print("nobj",len(bpy.data.objects))
