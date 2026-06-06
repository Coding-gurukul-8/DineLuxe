import type { ReactNode } from 'react'

type DialogProps = {
  open: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null
  return <div>{children}</div>
}

export function DialogContent({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: React.MouseEventHandler }) {
  return <div className={className} onClick={onClick}>{children}</div>
}

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={className}>{children}</h3>
}

export function DialogDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={className}>{children}</p>
}

export default Dialog
