import { z } from 'zod'

/** Bone names present on HandRig (pose targets). */
export const BONE_NAMES = [
  'Forearm',
  'Wrist_Radiocarpal',
  'Wrist_Midcarpal',
  'Index_CMC',
  'Index_MCP',
  'Index_PIP',
  'Index_DIP',
  'Middle_CMC',
  'Middle_MCP',
  'Middle_PIP',
  'Middle_DIP',
  'Ring_CMC',
  'Ring_MCP',
  'Ring_PIP',
  'Ring_DIP',
  'Little_CMC',
  'Little_MCP',
  'Little_PIP',
  'Little_DIP',
  'Thumb_CMC',
  'Thumb_MCP',
  'Thumb_IP',
] as const

export type BoneName = (typeof BONE_NAMES)[number]

/** Mesh object names in the glTF. */
export const MESH_NAMES = [
  'Radius',
  'Ulna',
  'Scaphoid',
  'Lunate',
  'Triquetrum',
  'Pisiform',
  'Trapezium',
  'Trapezoid',
  'Capitate',
  'Hamate',
  'Metacarpal_1',
  'Metacarpal_2',
  'Metacarpal_3',
  'Metacarpal_4',
  'Metacarpal_5',
  'ProxPhalanx_1',
  'ProxPhalanx_2',
  'ProxPhalanx_3',
  'ProxPhalanx_4',
  'ProxPhalanx_5',
  'MidPhalanx_2',
  'MidPhalanx_3',
  'MidPhalanx_4',
  'MidPhalanx_5',
  'DistPhalanx_1',
  'DistPhalanx_2',
  'DistPhalanx_3',
  'DistPhalanx_4',
  'DistPhalanx_5',
] as const

export type MeshName = (typeof MESH_NAMES)[number]

export const POSE_PRESETS = [
  'rest',
  'straight',
  'fist',
  'spread',
  'opp2',
  'opp3',
  'opp4',
  'opp5',
  'hook',
  'tabletop',
  'straightfist',
  'tg_fist',
  'wflex',
  'wext',
  'rdev',
  'udev',
] as const

export type PosePreset = (typeof POSE_PRESETS)[number]

export const CLINICAL_VIEWS = [
  'dorsal',
  'palmar',
  'radial',
  'ulnar',
  'scaphoid',
  'oblique',
] as const

export type ClinicalView = (typeof CLINICAL_VIEWS)[number]

export const RENDER_MODES = ['solid', 'xray', 'transparent'] as const
export type RenderMode = (typeof RENDER_MODES)[number]

const Vec3 = z.tuple([z.number(), z.number(), z.number()])

export const BonePoseSchema = z.object({
  bone: z.enum(BONE_NAMES),
  /** Euler XYZ degrees, anatomical convention matching Blender pose bones. */
  rotationDeg: Vec3,
})

export const KeyframeSchema = z.object({
  t: z.number().min(0),
  pose: z.union([z.enum(POSE_PRESETS), z.array(BonePoseSchema)]),
  easing: z.enum(['linear', 'easeInOut']).optional(),
})

export const ScaphoidFractureSchema = z.object({
  type: z.literal('scaphoid_fracture'),
  location: z.enum(['waist', 'proximal_pole', 'distal_pole']).default('waist'),
  displaced: z.boolean().default(false),
  displacementMm: z.number().min(0).max(8).optional(),
  fixation: z.enum(['none', 'cast', 'herbert_screw']).default('none'),
  /** Healing stage in weeks post-injury (0 = acute). */
  healingWeek: z.number().min(0).max(16).default(0),
  showSnuffbox: z.boolean().default(true),
  showBloodSupply: z.boolean().default(true),
  showFractureLine: z.boolean().default(true),
})

export const DistalRadiusFractureSchema = z.object({
  type: z.literal('distal_radius_fracture'),
  pattern: z.enum(['colles', 'smith']).default('colles'),
  displaced: z.boolean().default(true),
  displacementMm: z.number().min(0).max(12).optional(),
})

export const BoxersFractureSchema = z.object({
  type: z.literal('boxers_fracture'),
  /** Typical neck fracture of 5th metacarpal. */
  angulationDeg: z.number().min(0).max(70).default(40),
})

export const ScapholunateInjurySchema = z.object({
  type: z.literal('scapholunate_injury'),
  /** Radiographic SL gap in millimetres (normal ~1–2 mm; >3 mm suggests dissociation). */
  gapMm: z.number().min(0).max(8).default(4),
})

export const InjurySchema = z.discriminatedUnion('type', [
  ScaphoidFractureSchema,
  DistalRadiusFractureSchema,
  BoxersFractureSchema,
  ScapholunateInjurySchema,
])

export const CameraSchema = z.object({
  view: z.enum(CLINICAL_VIEWS).optional(),
  position: Vec3.optional(),
  target: Vec3.optional(),
  fov: z.number().min(10).max(90).optional(),
})

export const ClipSchema = z.object({
  /** Playback from baked GLB markers (frame numbers at 30 fps). */
  marker: z.string().optional(),
  frameStart: z.number().int().min(1).optional(),
  frameEnd: z.number().int().min(1).optional(),
  speed: z.number().min(0.1).max(4).optional(),
})

export const SceneSpecSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1).max(64).optional(),
  title: z.string().min(1).max(120),
  caption: z.string().max(800).optional(),
  captions: z
    .array(
      z.object({
        t: z.number().min(0),
        text: z.string().max(400),
      }),
    )
    .optional(),
  camera: CameraSchema.optional(),
  mode: z.enum(RENDER_MODES).optional(),
  highlights: z.array(z.enum(MESH_NAMES)).max(29).optional(),
  dimOthers: z.boolean().optional(),
  pose: z.union([z.enum(POSE_PRESETS), z.array(BonePoseSchema)]).optional(),
  keyframes: z.array(KeyframeSchema).max(48).optional(),
  duration: z.number().min(0.5).max(120).optional(),
  clip: ClipSchema.optional(),
  injuries: z.array(InjurySchema).max(4).optional(),
  annotations: z
    .array(
      z.object({
        id: z.string(),
        text: z.string().max(200),
        anchor: z.enum(MESH_NAMES).or(z.literal('snuffbox')),
      }),
    )
    .optional(),
  disclaimer: z.boolean().optional(),
})

export type SceneSpec = z.infer<typeof SceneSpecSchema>
export type Injury = z.infer<typeof InjurySchema>
export type ScaphoidFracture = z.infer<typeof ScaphoidFractureSchema>

/** Joint limits from scene_info.json (radians → we validate degrees). */
export const JOINT_LIMITS_RAD: Record<
  string,
  { min: [number, number, number]; max: [number, number, number] }
> = {
  Index_MCP: { min: [-0.566, 0, -0.524], max: [1.354, 0, 0.524] },
  Index_PIP: { min: [-0.348, 0, 0], max: [1.571, 0, 0] },
  Index_DIP: { min: [-0.295, 0, 0], max: [1.189, 0, 0] },
  Middle_MCP: { min: [-0.548, 0, -0.524], max: [1.372, 0, 0.524] },
  Middle_PIP: { min: [-0.154, 0, 0], max: [1.766, 0, 0] },
  Middle_DIP: { min: [-0.367, 0, 0], max: [1.117, 0, 0] },
  Ring_MCP: { min: [-0.596, 0, -0.524], max: [1.324, 0, 0.524] },
  Ring_PIP: { min: [-0.203, 0, 0], max: [1.717, 0, 0] },
  Ring_DIP: { min: [-0.533, 0, 0], max: [0.951, 0, 0] },
  Little_MCP: { min: [-0.58, 0, -0.524], max: [1.34, 0, 0.524] },
  Little_PIP: { min: [-0.169, 0, 0], max: [1.751, 0, 0] },
  Little_DIP: { min: [-0.125, 0, 0], max: [1.358, 0, 0] },
  Thumb_MCP: { min: [-0.277, 0, 0], max: [0.683, 0, 0] },
  Thumb_IP: { min: [-0.135, 0, 0], max: [1.436, 0, 0] },
  // Wrist: approximate physiological ranges (rad)
  Wrist_Radiocarpal: { min: [-1.22, -0.35, -0.35], max: [1.05, 0.35, 0.52] },
  Wrist_Midcarpal: { min: [-0.7, -0.2, -0.35], max: [0.9, 0.2, 0.35] },
}
