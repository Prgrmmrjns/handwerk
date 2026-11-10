"""
Headless Blender renderer for Handwerk scene-spec JSON.

Blender authors the rigged skeleton and can render cinematic stills/MP4s from
the same SceneSpec DSL the browser plays back via glTF.

Usage:
  blender --background blender-hand/hand_skeleton.blend \\
    --python blender/scripts/render_scene.py -- \\
    --scene scenes/scaphoid_displaced.json \\
    --out artifacts/scaphoid_displaced.mp4 \\
    --engine BLENDER_EEVEE_NEXT \\
    --frames 1 60

If Blender is not available, this script can still validate the scene JSON:
  python3 blender/scripts/render_scene.py --scene scenes/scaphoid_displaced.json --dry-run
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

# Allow running outside Blender for dry-run validation
IN_BLENDER = "bpy" in sys.modules or any("blender" in (a or "").lower() for a in sys.argv[:1])
try:
    import bpy
    from mathutils import Euler, Vector

    IN_BLENDER = True
except ImportError:
    IN_BLENDER = False


ROOT = Path(__file__).resolve().parents[2]


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Render a Handwerk scene-spec with Blender")
    p.add_argument("--scene", required=True, help="Path to scene-spec JSON")
    p.add_argument("--out", default="artifacts/render.mp4")
    p.add_argument("--engine", default="BLENDER_EEVEE_NEXT", choices=["BLENDER_EEVEE_NEXT", "CYCLES", "BLENDER_WORKBENCH"])
    p.add_argument("--frames", nargs=2, type=int, default=None, metavar=("START", "END"))
    p.add_argument("--resolution", nargs=2, type=int, default=[1280, 720], metavar=("W", "H"))
    p.add_argument("--still", action="store_true", help="Render a single PNG instead of MP4")
    p.add_argument("--dry-run", action="store_true", help="Validate JSON only (no Blender)")
    p.add_argument("--apply-scaphoid-split", action="store_true")
    if argv is None:
        argv = sys.argv
        if "--" in argv:
            argv = argv[argv.index("--") + 1 :]
        elif IN_BLENDER:
            argv = []
        else:
            argv = argv[1:]
    return p.parse_args(argv)


def load_scene(path: Path) -> dict:
    data = json.loads(path.read_text())
    if data.get("version") != 1:
        raise SystemExit("scene.version must be 1")
    if not data.get("title"):
        raise SystemExit("scene.title required")
    return data


def set_pose_from_preset(arm, poses: dict, preset: str):
    pose = poses.get(preset)
    if not pose:
        return
    for bone_name, xyz in pose.items():
        pb = arm.pose.bones.get(bone_name)
        if not pb:
            continue
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = Euler(xyz, "XYZ")


def set_camera_view(view: str):
    cam = bpy.data.objects.get("Camera")
    orbit = bpy.data.objects.get("CamOrbit")
    target = bpy.data.objects.get("CamTarget")
    presets = {
        "dorsal": ((0.02, -0.28, 0.08), (0.01, 0, 0.04)),
        "palmar": ((0.02, 0.28, 0.06), (0.01, 0, 0.04)),
        "radial": ((0.28, -0.05, 0.06), (0.01, 0, 0.04)),
        "ulnar": ((-0.28, -0.02, 0.06), (0.01, 0, 0.04)),
        "scaphoid": ((0.18, -0.16, 0.14), (0.02, -0.01, 0.01)),
        "oblique": ((0.16, -0.2, 0.12), (0.01, 0, 0.04)),
    }
    pos, tgt = presets.get(view, presets["dorsal"])
    if target:
        target.location = Vector(tgt)
    if cam and not orbit:
        cam.location = Vector(pos)
    elif orbit:
        # Approximate by aiming orbit empty
        orbit.location = Vector(tgt)
        if cam:
            cam.location = Vector(pos) - Vector(tgt)


def highlight(names):
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        if obj.name in names:
            for slot in obj.material_slots:
                if slot.material and slot.material.use_nodes:
                    bsdf = slot.material.node_tree.nodes.get("Principled BSDF")
                    if bsdf and "Emission Color" in bsdf.inputs:
                        bsdf.inputs["Emission Color"].default_value = (0.75, 0.55, 0.25, 1)
                        if "Emission Strength" in bsdf.inputs:
                            bsdf.inputs["Emission Strength"].default_value = 0.4


def apply_injuries(scene: dict):
    for inj in scene.get("injuries") or []:
        if inj.get("type") == "scaphoid_fracture":
            scaphoid = bpy.data.objects.get("Scaphoid")
            if not scaphoid:
                continue
            # Visual cue: emit reddish on scaphoid material
            for slot in scaphoid.material_slots:
                if slot.material and slot.material.use_nodes:
                    bsdf = slot.material.node_tree.nodes.get("Principled BSDF")
                    if bsdf and "Emission Color" in bsdf.inputs:
                        bsdf.inputs["Emission Color"].default_value = (0.8, 0.2, 0.15, 1)
                        if "Emission Strength" in bsdf.inputs:
                            bsdf.inputs["Emission Strength"].default_value = 0.35
            if inj.get("displaced"):
                gap = (inj.get("displacementMm") or 2.5) * 0.001
                scaphoid.location.x += gap * 0.5
            # Optional procedural note text via Title object
            title = bpy.data.objects.get("Title")
            if title and hasattr(title.data, "body"):
                title.data.body = scene.get("title", "Scaphoid fracture")


def render(scene: dict, args):
    scn = bpy.context.scene
    scn.render.engine = args.engine
    scn.render.resolution_x, scn.render.resolution_y = args.resolution
    scn.render.fps = 30

    arm = bpy.data.objects.get("HandRig")
    poses_path = ROOT / "blender-hand" / "poses.json"
    poses = json.loads(poses_path.read_text()) if poses_path.exists() else {}

    if arm and isinstance(scene.get("pose"), str):
        set_pose_from_preset(arm, poses, scene["pose"])

    cam = scene.get("camera") or {}
    if cam.get("view"):
        set_camera_view(cam["view"])

    if scene.get("highlights"):
        highlight(scene["highlights"])

    apply_injuries(scene)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    if args.still or out.suffix.lower() in {".png", ".jpg", ".jpeg"}:
        scn.render.filepath = str(out.with_suffix(".png"))
        bpy.ops.render.render(write_still=True)
        print("Wrote", scn.render.filepath)
        return

    start, end = args.frames if args.frames else (1, 60)
    scn.frame_start = start
    scn.frame_end = end
    scn.render.image_settings.file_format = "FFMPEG"
    scn.render.ffmpeg.format = "MPEG4"
    scn.render.ffmpeg.codec = "H264"
    scn.render.filepath = str(out)
    bpy.ops.render.render(animation=True)
    print("Wrote", out)


def main():
    args = parse_args()
    scene_path = Path(args.scene)
    if not scene_path.is_absolute():
        scene_path = (Path.cwd() / scene_path).resolve()
    scene = load_scene(scene_path)
    print("Scene:", scene.get("id") or scene["title"])

    if args.dry_run or not IN_BLENDER:
        print("Dry-run OK" if args.dry_run or not IN_BLENDER else "")
        if not IN_BLENDER and not args.dry_run:
            raise SystemExit("Not running inside Blender — pass --dry-run or invoke via blender --python")
        return

    if args.apply_scaphoid_split:
        # Defer to companion script semantics: mark only
        print("Note: run split_scaphoid.py first for mesh fragments; applying emissive cues only")

    render(scene, args)


if __name__ == "__main__":
    main()
