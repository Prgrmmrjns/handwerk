/** Display labels + FMA ids for hover UI (from map.tsv / labeled stills). */

export type BoneInfo = {
  mesh: string
  label: string
  short: string
  fma: string
  group: 'forearm' | 'carpal' | 'metacarpal' | 'phalanx'
}

export const BONE_INFO: Record<string, BoneInfo> = {
  Radius: { mesh: 'Radius', label: 'Radius', short: 'Radius', fma: 'FMA23464', group: 'forearm' },
  Ulna: { mesh: 'Ulna', label: 'Ulna', short: 'Ulna', fma: 'FMA23467', group: 'forearm' },
  Scaphoid: { mesh: 'Scaphoid', label: 'Scaphoid', short: 'Scaphoid', fma: 'FMA24435', group: 'carpal' },
  Lunate: { mesh: 'Lunate', label: 'Lunate', short: 'Lunate', fma: 'FMA24437', group: 'carpal' },
  Triquetrum: { mesh: 'Triquetrum', label: 'Triquetrum', short: 'Triquetrum', fma: 'FMA24439', group: 'carpal' },
  Pisiform: { mesh: 'Pisiform', label: 'Pisiform', short: 'Pisiform', fma: 'FMA24441', group: 'carpal' },
  Trapezium: { mesh: 'Trapezium', label: 'Trapezium', short: 'Trapezium', fma: 'FMA24443', group: 'carpal' },
  Trapezoid: { mesh: 'Trapezoid', label: 'Trapezoid', short: 'Trapezoid', fma: 'FMA23725', group: 'carpal' },
  Capitate: { mesh: 'Capitate', label: 'Capitate', short: 'Capitate', fma: 'FMA24446', group: 'carpal' },
  Hamate: { mesh: 'Hamate', label: 'Hamate', short: 'Hamate', fma: 'FMA24448', group: 'carpal' },
  Metacarpal_1: { mesh: 'Metacarpal_1', label: 'Metacarpal I (thumb)', short: 'MC I', fma: 'FMA24464', group: 'metacarpal' },
  Metacarpal_2: { mesh: 'Metacarpal_2', label: 'Metacarpal II (index)', short: 'MC II', fma: 'FMA24466', group: 'metacarpal' },
  Metacarpal_3: { mesh: 'Metacarpal_3', label: 'Metacarpal III (middle)', short: 'MC III', fma: 'FMA24468', group: 'metacarpal' },
  Metacarpal_4: { mesh: 'Metacarpal_4', label: 'Metacarpal IV (ring)', short: 'MC IV', fma: 'FMA24470', group: 'metacarpal' },
  Metacarpal_5: { mesh: 'Metacarpal_5', label: 'Metacarpal V (little)', short: 'MC V', fma: 'FMA24472', group: 'metacarpal' },
  ProxPhalanx_1: { mesh: 'ProxPhalanx_1', label: 'Proximal phalanx (thumb)', short: 'PP I', fma: 'FMA24450', group: 'phalanx' },
  ProxPhalanx_2: { mesh: 'ProxPhalanx_2', label: 'Proximal phalanx (index)', short: 'PP II', fma: 'FMA24451', group: 'phalanx' },
  ProxPhalanx_3: { mesh: 'ProxPhalanx_3', label: 'Proximal phalanx (middle)', short: 'PP III', fma: 'FMA24452', group: 'phalanx' },
  ProxPhalanx_4: { mesh: 'ProxPhalanx_4', label: 'Proximal phalanx (ring)', short: 'PP IV', fma: 'FMA24453', group: 'phalanx' },
  ProxPhalanx_5: { mesh: 'ProxPhalanx_5', label: 'Proximal phalanx (little)', short: 'PP V', fma: 'FMA24454', group: 'phalanx' },
  MidPhalanx_2: { mesh: 'MidPhalanx_2', label: 'Middle phalanx (index)', short: 'MP II', fma: 'FMA24455', group: 'phalanx' },
  MidPhalanx_3: { mesh: 'MidPhalanx_3', label: 'Middle phalanx (middle)', short: 'MP III', fma: 'FMA24456', group: 'phalanx' },
  MidPhalanx_4: { mesh: 'MidPhalanx_4', label: 'Middle phalanx (ring)', short: 'MP IV', fma: 'FMA24457', group: 'phalanx' },
  MidPhalanx_5: { mesh: 'MidPhalanx_5', label: 'Middle phalanx (little)', short: 'MP V', fma: 'FMA24458', group: 'phalanx' },
  DistPhalanx_1: { mesh: 'DistPhalanx_1', label: 'Distal phalanx (thumb)', short: 'DP I', fma: 'FMA24459', group: 'phalanx' },
  DistPhalanx_2: { mesh: 'DistPhalanx_2', label: 'Distal phalanx (index)', short: 'DP II', fma: 'FMA24460', group: 'phalanx' },
  DistPhalanx_3: { mesh: 'DistPhalanx_3', label: 'Distal phalanx (middle)', short: 'DP III', fma: 'FMA24461', group: 'phalanx' },
  DistPhalanx_4: { mesh: 'DistPhalanx_4', label: 'Distal phalanx (ring)', short: 'DP IV', fma: 'FMA24462', group: 'phalanx' },
  DistPhalanx_5: { mesh: 'DistPhalanx_5', label: 'Distal phalanx (little)', short: 'DP V', fma: 'FMA24463', group: 'phalanx' },
}

export const MARKERS: { name: string; frame: number }[] = [
  { name: 'Rest (relaxed hand)', frame: 1 },
  { name: 'Fingers straight', frame: 61 },
  { name: 'Full fist', frame: 127 },
  { name: 'Finger spread (abduction)', frame: 241 },
  { name: 'Thumb opposition: index', frame: 343 },
  { name: 'Thumb opposition: middle', frame: 397 },
  { name: 'Thumb opposition: ring', frame: 451 },
  { name: 'Thumb opposition: little', frame: 508 },
  { name: 'Tendon gliding: straight', frame: 607 },
  { name: 'Tendon gliding: hook fist', frame: 661 },
  { name: 'Tendon gliding: full fist', frame: 727 },
  { name: 'Tendon gliding: tabletop', frame: 799 },
  { name: 'Tendon gliding: straight fist', frame: 868 },
  { name: 'Tendon gliding: straight (end)', frame: 937 },
  { name: 'Wrist flexion 80°', frame: 1021 },
  { name: 'Wrist extension 70°', frame: 1099 },
  { name: 'Radial deviation 20°', frame: 1195 },
  { name: 'Ulnar deviation 30°', frame: 1261 },
  { name: 'Back to rest', frame: 1321 },
]

export const FPS = 30
export const FRAME_START = 1
export const FRAME_END = 1351
export const CLIP_DURATION = (FRAME_END - FRAME_START) / FPS
