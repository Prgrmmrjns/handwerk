"""
Headless Blender renderer for Handwerk scene-spec JSON.

Shows the same fracture / screw / highlight language as the browser:
split scaphoid fragments, gap, screw, cast cue, wrist-zoomed camera,
and captions placed in the lower third (not over the fingers).
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

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
    p.add_argument(
        "--engine",
        default="BLENDER_WORKBENCH",
        choices=["BLENDER_EEVEE_NEXT", "CYCLES", "BLENDER_WORKBENCH"],
    )
    p.add_argument("--frames", nargs=2, type=int, default=None, metavar=("START", "END"))
    p.add_argument("--resolution", nargs=2, type=int, default=[1280, 720], metavar=("W", "H"))
    p.add_argument("--still", action="store_true", help="Render a single PNG instead of MP4")
    p.add_argument("--dry-run", action="store_true", help="Validate JSON only (no Blender)")
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


def mat(name, color, emission=(0, 0, 0), emit=0.0, metal=0.0, rough=0.45):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metal
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = emit
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    # Workbench / viewport colour
    m.diffuse_color = (*color, 1)
    return m


def assign_mat(obj, material):
    if obj.data.materials:
        for i in range(len(obj.data.materials)):
            obj.data.materials[i] = material
    else:
        obj.data.materials.append(material)
    obj.color = material.diffuse_color


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


def nuke_overlay_text():
    for obj in list(bpy.data.objects):
        if obj.type == "FONT" or obj.name.startswith("Cap_") or obj.name in {
            "Title",
            "Subtitle",
        }:
            obj.hide_render = True
            obj.hide_viewport = True
            obj.hide_set(True)
            try:
                bpy.data.objects.remove(obj, do_unlink=True)
            except Exception:
                pass


def frame_wrist_camera(view: str = "scaphoid"):
    """Reuse the file's CamOrbit rig — retarget to the carpus and dolly in."""
    cam = bpy.data.objects.get("Camera")
    orbit = bpy.data.objects.get("CamOrbit")
    target = bpy.data.objects.get("CamTarget")
    scaphoid = bpy.data.objects.get("Scaphoid_Proximal") or bpy.data.objects.get("Scaphoid")
    focus = Vector((0.02, -0.01, 0.005))
    if scaphoid:
        bbox = [scaphoid.matrix_world @ Vector(c) for c in scaphoid.bound_box]
        focus = sum(bbox, Vector()) / 8.0

    # Orbit empty sits at the look-at point in this file
    if target:
        target.location = focus + Vector((0, 0, 0.004))
    if orbit:
        orbit.location = focus + Vector((0, 0, 0.002))
        # yaw for clinical views (radians)
        yaws = {
            "dorsal": 0.15,
            "palmar": 3.2,
            "radial": 1.1,
            "ulnar": -1.0,
            "scaphoid": 0.55,
            "oblique": 0.35,
        }
        orbit.rotation_euler = Euler((0, 0, yaws.get(view, 0.55)), "XYZ")

    if cam:
        # Dolly in: original local was ~(0, -0.62, 0.09); wrist close-up ~0.18–0.28
        distances = {
            "dorsal": 0.26,
            "palmar": 0.26,
            "radial": 0.22,
            "ulnar": 0.22,
            "scaphoid": 0.18,
            "oblique": 0.22,
        }
        dist = distances.get(view, 0.2)
        cam.location = Vector((0.02, -dist, 0.04))
        if cam.data:
            cam.data.lens = 85
            cam.data.clip_start = 0.001
            cam.data.clip_end = 10
    bpy.context.view_layer.update()


def dim_others(keep: set[str]):
    bone = mat("HW_BoneDim", (0.42, 0.40, 0.38), rough=0.6)
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        if obj.name in keep or obj.name.startswith("Scaphoid_"):
            continue
        if obj.name.startswith("HW_"):
            continue
        assign_mat(obj, bone)
        obj.color = (0.42, 0.40, 0.38, 1)


def bisect_scaphoid(inj: dict):
    scaphoid = bpy.data.objects.get("Scaphoid")
    if not scaphoid:
        print("WARN: Scaphoid missing")
        return None

    bpy.context.view_layer.update()
    bbox = [scaphoid.matrix_world @ Vector(c) for c in scaphoid.bound_box]
    center = sum(bbox, Vector()) / 8.0
    xs = sorted(v.x for v in bbox)
    span = max(1e-6, xs[-1] - xs[0])
    bias = 0.0
    loc = inj.get("location", "waist")
    if loc == "proximal_pole":
        bias = -span * 0.22
    elif loc == "distal_pole":
        bias = span * 0.22
    plane_co = Vector((center.x + bias, center.y, center.z))
    plane_no = Vector((1, 0, 0))

    def dup(name):
        o = scaphoid.copy()
        o.data = scaphoid.data.copy()
        o.name = name
        bpy.context.collection.objects.link(o)
        o.parent = scaphoid.parent
        o.parent_type = scaphoid.parent_type
        o.parent_bone = scaphoid.parent_bone
        o.matrix_parent_inverse = scaphoid.matrix_parent_inverse.copy()
        o.hide_render = False
        o.hide_viewport = False
        return o

    prox = dup("Scaphoid_Proximal")
    dist = dup("Scaphoid_Distal")

    def cut(obj, clear_inner):
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

    cut(prox, clear_inner=False)
    cut(dist, clear_inner=True)

    displaced = bool(inj.get("displaced"))
    gap = (inj.get("displacementMm") or (2.5 if displaced else 0.4)) * 0.001
    gap *= 4.0 if displaced else 2.2
    # Offset in X and slightly in Y so the step-off reads from the clinical camera
    dist.location.x += gap
    if displaced:
        dist.location.y += gap * 0.45
        dist.rotation_euler.z += 0.12

    heal = min(1.0, float(inj.get("healingWeek") or 0) / 12.0)
    prox_col = (0.85, 0.25 + heal * 0.35, 0.12 + heal * 0.25)
    dist_col = (0.95, 0.88, 0.72)
    assign_mat(
        prox,
        mat("HW_Prox", prox_col, emission=prox_col, emit=0.7 * (1 - heal * 0.5), rough=0.35),
    )
    assign_mat(
        dist,
        mat("HW_Dist", dist_col, emission=(0.7, 0.5, 0.2), emit=0.35),
    )
    # Workbench reads object colour when shading.color_type == 'OBJECT'
    prox.color = (*prox_col, 1)
    dist.color = (*dist_col, 1)

    scaphoid.hide_render = True
    scaphoid.hide_viewport = True
    scaphoid.hide_set(True)

    # Fracture disc — bright red
    bpy.ops.mesh.primitive_cylinder_add(radius=0.01, depth=0.0012, location=plane_co)
    disc = bpy.context.active_object
    disc.name = "HW_FracturePlane"
    disc.rotation_euler = (0, math.pi / 2, 0)
    fx = (0.95, 0.15, 0.1) if heal < 0.55 else (0.25, 0.75, 0.35)
    assign_mat(disc, mat("HW_Fx", fx, emission=fx, emit=0.8))
    disc.color = (*fx, 1)

    if inj.get("fixation") == "herbert_screw":
        screw_col = (0.55, 0.75, 0.95)
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.0032, depth=0.028, location=plane_co + Vector((gap * 0.2, 0, 0))
        )
        screw = bpy.context.active_object
        screw.name = "HW_HerbertScrew"
        screw.rotation_euler = (0, math.pi / 2, 0)
        assign_mat(screw, mat("HW_Screw", screw_col, metal=0.95, rough=0.15))
        screw.color = (*screw_col, 1)
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.0045, depth=0.0035, location=plane_co + Vector((gap * 0.2 + 0.013, 0, 0))
        )
        head = bpy.context.active_object
        head.name = "HW_ScrewHead"
        head.rotation_euler = (0, math.pi / 2, 0)
        assign_mat(head, mat("HW_ScrewHead", (0.35, 0.55, 0.85), metal=0.95, rough=0.15))
        head.color = (0.35, 0.55, 0.85, 1)

    if inj.get("fixation") == "cast":
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.032, location=center + Vector((0, 0, -0.008)))
        cast = bpy.context.active_object
        cast.name = "HW_Cast"
        assign_mat(cast, mat("HW_CastMat", (0.85, 0.76, 0.55), rough=0.75))
        cast.color = (0.85, 0.76, 0.55, 0.35)

    if inj.get("showSnuffbox", True):
        snuff = center + Vector((0.014, -0.014, 0.01))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.004, location=snuff)
        m = bpy.context.active_object
        m.name = "HW_Snuffbox"
        assign_mat(m, mat("HW_Snuff", (0.25, 0.65, 0.9), emission=(0.25, 0.65, 0.9), emit=0.9))
        m.color = (0.2, 0.7, 1.0, 1)

    if inj.get("showBloodSupply", True):
        a = center + Vector((0.012, -0.006, 0.004))
        b = center + Vector((-0.01, 0.003, -0.003))
        mid = (a + b) / 2
        direction = b - a
        bpy.ops.mesh.primitive_cylinder_add(radius=0.0012, depth=max(0.001, direction.length), location=mid)
        shaft = bpy.context.active_object
        shaft.name = "HW_Vessel"
        shaft.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
        assign_mat(
            shaft,
            mat("HW_Blood", (0.85, 0.12, 0.12), emission=(0.9, 0.1, 0.1), emit=1.0),
        )
        shaft.color = (1.0, 0.15, 0.12, 1)

    print(
        f"Scaphoid split OK — prox={len(prox.data.vertices)}v dist={len(dist.data.vertices)}v gap={gap*1000:.1f}mm"
    )
    return {"prox": prox, "dist": dist, "center": center}


def apply_other_injuries(inj: dict):
    if inj.get("type") == "distal_radius_fracture":
        radius = bpy.data.objects.get("Radius")
        if radius:
            gap = (inj.get("displacementMm") or 4) * 0.001 * 2.5
            radius.location.y += gap * 0.5
            radius.rotation_euler.x += 0.25
            assign_mat(
                radius,
                mat("HW_RadiusFx", (0.9, 0.45, 0.35), emission=(0.8, 0.2, 0.12), emit=0.55),
            )
    if inj.get("type") == "boxers_fracture":
        mc5 = bpy.data.objects.get("Metacarpal_5")
        if mc5:
            ang = math.radians(inj.get("angulationDeg") or 40) * 0.55
            mc5.rotation_euler.x += ang
            assign_mat(
                mc5,
                mat("HW_Boxer", (0.9, 0.45, 0.35), emission=(0.8, 0.2, 0.12), emit=0.55),
            )
    if inj.get("type") == "scapholunate_injury":
        scaphoid = bpy.data.objects.get("Scaphoid")
        lunate = bpy.data.objects.get("Lunate")
        gap = (inj.get("gapMm") or 4.5) * 0.001 * 1.2
        if scaphoid:
            scaphoid.location.x += gap
            assign_mat(scaphoid, mat("HW_SL_S", (0.9, 0.75, 0.35), emission=(0.7, 0.5, 0.1), emit=0.4))
        if lunate:
            lunate.location.x -= gap * 0.85
            assign_mat(lunate, mat("HW_SL_L", (0.9, 0.75, 0.35), emission=(0.7, 0.5, 0.1), emit=0.4))


def add_caption_banner(scene: dict):
    """Remove 3D scene fonts; write a 2D caption strip via compositor text is heavy —
    instead parent compact text far below the subject in camera space."""
    nuke_overlay_text()
    cam = bpy.data.objects.get("Camera")
    if not cam:
        return

    title = scene.get("title", "Handwerk")
    caption = scene.get("caption") or ""
    if scene.get("captions"):
        caption = scene["captions"][0].get("text", caption)

    def make_text(name, body, size, loc, color):
        curve = bpy.data.curves.new(type="FONT", name=name + "Data")
        curve.body = body
        curve.size = size
        curve.align_x = "CENTER"
        curve.align_y = "TOP"
        obj = bpy.data.objects.new(name, curve)
        bpy.context.collection.objects.link(obj)
        obj.parent = cam
        # Keep parent inverse identity so location is camera-local
        obj.matrix_parent_inverse.identity()
        obj.location = loc
        obj.rotation_euler = (0, 0, 0)
        assign_mat(obj, mat(name + "Mat", color, emission=color, emit=0.35))
        return obj

    # Camera looks down -Z; Y is up in view. Place strip near bottom of frame.
    make_text("HW_TitleBanner", title[:90], 0.007, (0.0, -0.055, -0.20), (0.95, 0.9, 0.78))
    if caption:
        words = caption.split()
        lines, cur = [], []
        for w in words:
            cur.append(w)
            if len(" ".join(cur)) > 58:
                lines.append(" ".join(cur))
                cur = []
        if cur:
            lines.append(" ".join(cur))
        make_text(
            "HW_CaptionBanner",
            "\n".join(lines[:2]),
            0.004,
            (0.0, -0.068, -0.20),
            (0.78, 0.86, 0.94),
        )


def composite_caption(path: str, scene: dict):
    """Draw a clean lower-third caption in image space (no mesh overlap)."""
    from PIL import Image, ImageDraw, ImageFont

    im = Image.open(path).convert("RGBA")
    w, h = im.size
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    band_h = int(h * 0.16)
    draw.rectangle((0, h - band_h, w, h), fill=(8, 12, 20, 210))
    title = scene.get("title", "Handwerk")
    caption = scene.get("caption") or ""
    if scene.get("captions"):
        caption = scene["captions"][0].get("text", caption)
    try:
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", max(18, w // 40))
        font_body = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", max(14, w // 55))
    except Exception:
        font_title = ImageFont.load_default()
        font_body = font_title
    y = h - band_h + 14
    draw.text((w // 2, y), title, fill=(240, 225, 190, 255), font=font_title, anchor="ma")
    # wrap caption
    words = caption.split()
    lines, cur = [], []
    for word in words:
        cur.append(word)
        if len(" ".join(cur)) > 78:
            lines.append(" ".join(cur))
            cur = []
    if cur:
        lines.append(" ".join(cur))
    for i, line in enumerate(lines[:2]):
        draw.text(
            (w // 2, y + 28 + i * 22),
            line,
            fill=(180, 200, 220, 255),
            font=font_body,
            anchor="ma",
        )
    out = Image.alpha_composite(im, overlay).convert("RGB")
    out.save(path)
    print("Caption composited:", path, flush=True)


def configure_workbench(scn):
    scn.render.engine = "BLENDER_WORKBENCH"
    shading = scn.display.shading
    shading.light = "STUDIO"
    # OBJECT colour makes prox/dist/screw vividly distinct in headless Workbench
    shading.color_type = "OBJECT"
    shading.show_shadows = True
    shading.show_specular_highlight = True


def render(scene: dict, args):
    scn = bpy.context.scene
    scn.render.resolution_x, scn.render.resolution_y = args.resolution
    scn.render.fps = 30
    scn.render.film_transparent = False
    scn.render.engine = args.engine
    if args.engine == "BLENDER_WORKBENCH":
        configure_workbench(scn)

    arm = bpy.data.objects.get("HandRig")
    poses_path = ROOT / "blender-hand" / "poses.json"
    poses = json.loads(poses_path.read_text()) if poses_path.exists() else {}

    if arm and isinstance(scene.get("pose"), str):
        set_pose_from_preset(arm, poses, scene["pose"])

    bpy.context.view_layer.update()

    keep: set[str] = set(scene.get("highlights") or [])
    injuries = scene.get("injuries") or []
    for inj in injuries:
        if inj.get("type") == "scaphoid_fracture":
            bisect_scaphoid(inj)
            keep.update(
                {
                    "Scaphoid_Proximal",
                    "Scaphoid_Distal",
                    "HW_FracturePlane",
                    "HW_HerbertScrew",
                    "HW_ScrewHead",
                    "HW_Snuffbox",
                    "HW_Vessel",
                    "HW_Cast",
                }
            )
        else:
            apply_other_injuries(inj)

    if keep or injuries:
        dim_others(keep)

    cam = scene.get("camera") or {}
    view = cam.get("view") or (
        "scaphoid"
        if any(i.get("type") in {"scaphoid_fracture", "scapholunate_injury"} for i in injuries)
        else "dorsal"
    )
    frame_wrist_camera(view)
    # Prefer image-space caption strip (no finger overlap). Nuke leftover 3D fonts.
    nuke_overlay_text()

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    # Ensure our camera is active
    cam_obj = bpy.data.objects.get("Camera")
    if cam_obj:
        scn.camera = cam_obj

    if args.still or out.suffix.lower() in {".png", ".jpg", ".jpeg"}:
        path = str(out.with_suffix(".png"))
        scn.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print("Wrote", path, flush=True)
        try:
            composite_caption(path, scene)
        except Exception as e:
            print("Caption composite skipped:", e, flush=True)
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
    print("Scene:", scene.get("id") or scene["title"], flush=True)

    if args.dry_run or not IN_BLENDER:
        print("Dry-run OK")
        if not IN_BLENDER and not args.dry_run:
            raise SystemExit(
                "Not running inside Blender — pass --dry-run or invoke via blender --python"
            )
        return

    render(scene, args)


if __name__ == "__main__":
    main()
