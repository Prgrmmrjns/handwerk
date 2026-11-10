import { useAppStore } from '../lib/store'
import { BONE_INFO } from '../scene/anatomy'

export function BoneLabel() {
  const hovered = useAppStore((s) => s.hoveredBone)
  const selected = useAppStore((s) => s.selectedBone)
  const show = useAppStore((s) => s.showLabels)
  const name = hovered || selected
  if (!show || !name) return null
  const info = BONE_INFO[name]
  if (!info) return null

  return (
    <div className="bone-label" role="status">
      <strong>{info.label}</strong>
      <span>{info.fma}</span>
    </div>
  )
}
