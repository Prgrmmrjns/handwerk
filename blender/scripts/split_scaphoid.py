"""
Reproducible scaphoid waist split for Handwerk.

Usage (Blender 4.2+):
  blender blender-hand/hand_skeleton.blend --background \\
    --python blender/scripts/split_scaphoid.py -- \\
    --output blender-hand/hand_skeleton_fracture.blend

Creates Scaphoid_Proximal and Scaphoid_Distal mesh objects parented to the
same bone as Scaphoid (Wrist_Radiocarpal), hides the original Scaphoid, and
writes a JSON sidecar with cut parameters.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    p = argparse.ArgumentParser()
    p.add_argument("--output", required=True)
    p.add_argument("--location", default="waist", choices=["waist", "proximal_pole", "distal_pole"])
    p.add_argument("--gap-mm", type=float, default=0.0)
    return p.parse_args(argv)


def bisect_object(obj: bpy.types.Object, plane_co: Vector, plane_no: Vector, clear_inner: bool):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.bisect(
        plane_co=plane_co,
        plane_no=plane_no,
        clear_inner=clear_inner,
        clear_outer=not clear_inner,
        use_fill=True,
    )
    bpy.ops.object.mode_set(mode="OBJECT")


def main():
    args = parse_args()
    scaphoid = bpy.data.objects.get("Scaphoid")
    if scaphoid is None:
        raise SystemExit("Scaphoid mesh not found")

    # Duplicate twice
    prox = scaphoid.copy()
    prox.data = scaphoid.data.copy()
    prox.name = "Scaphoid_Proximal"
    bpy.context.collection.objects.link(prox)

    dist = scaphoid.copy()
    dist.data = scaphoid.data.copy()
    dist.name = "Scaphoid_Distal"
    bpy.context.collection.objects.link(dist)

    # World-space bounds → cut plane through waist (local X of object roughly long axis)
    bbox = [scaphoid.matrix_world @ Vector(c) for c in scaphoid.bound_box]
    center = sum(bbox, Vector()) / 8.0
    xs = sorted(v.x for v in bbox)
    span = xs[-1] - xs[0]
    bias = 0.0
    if args.location == "proximal_pole":
        bias = -span * 0.22
    elif args.location == "distal_pole":
        bias = span * 0.22
    plane_co = Vector((center.x + bias, center.y, center.z))
    plane_no = Vector((1, 0, 0))

    bisect_object(prox, plane_co, plane_no, clear_inner=False)  # keep lower X
    bisect_object(dist, plane_co, plane_no, clear_inner=True)  # keep higher X

    gap = args.gap_mm * 0.001
    if gap:
        dist.location.x += gap

    # Parent like original
    for frag in (prox, dist):
        frag.parent = scaphoid.parent
        frag.parent_type = scaphoid.parent_type
        frag.parent_bone = scaphoid.parent_bone
        frag.matrix_parent_inverse = scaphoid.matrix_parent_inverse.copy()

    scaphoid.hide_render = True
    scaphoid.hide_viewport = True

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out))

    meta = {
        "source": "Scaphoid",
        "location": args.location,
        "plane_co": list(plane_co),
        "plane_no": list(plane_no),
        "gap_mm": args.gap_mm,
        "fragments": ["Scaphoid_Proximal", "Scaphoid_Distal"],
    }
    out.with_suffix(".scaphoid_split.json").write_text(json.dumps(meta, indent=2))
    print("Wrote", out)


if __name__ == "__main__":
    main()
