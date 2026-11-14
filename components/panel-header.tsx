import type { LucideIcon } from 'lucide-react'

// Section header from the team mockup: a purple step/role badge, a bold title and an icon on the right.
export function PanelHeader({ badge, title, icon: Icon, titleId }: { badge: string; title: string; icon: LucideIcon; titleId?: string }) {
  return <header className="step-header">
    <span className="step-badge">{badge}</span>
    <h2 className="step-title" id={titleId}>{title}</h2>
    <Icon size={24} className="step-icon" aria-hidden="true" />
  </header>
}
