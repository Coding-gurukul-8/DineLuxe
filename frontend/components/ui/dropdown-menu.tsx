import type { ReactNode } from 'react'

export function DropdownMenu({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

export function DropdownMenuTrigger({ children, asChild }: { children: ReactNode; asChild?: boolean }) {
  // asChild is supported by callers; return children directly so the button is used
  return <>{children}</>
}

export function DropdownMenuContent({ children, className, align }: { children: ReactNode; className?: string; align?: 'start' | 'end' | string }) {
  const alignClass = align === 'end' ? 'origin-top-right' : ''
  return <div className={`${alignClass} ${className ?? ''}`.trim()}>{children}</div>
}

export function DropdownMenuItem({ children, onClick, className }: { children: ReactNode; onClick?: React.MouseEventHandler; className?: string }) {
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  )
}

export function DropdownMenuSeparator() {
  return <div className="my-1 border-t border-gray-100" />
}

export default DropdownMenu
