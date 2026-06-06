import type { ReactNode } from 'react'

type SheetProps = {
	open: boolean
	onClose?: () => void
	onOpenChange?: (open: boolean) => void
	title?: string
	children: ReactNode
}

export function Sheet({ open, onClose, onOpenChange, title, children }: SheetProps) {
	if (!open) return null

	const handleClose = () => {
		onClose?.()
		onOpenChange?.(false)
	}

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-4 backdrop-blur">
			<div className="w-full max-w-lg rounded-t-3xl border border-ink/10 bg-paper p-6 shadow-soft">
				<div className="flex items-center justify-between">
					{title && <h3 className="font-display text-xl text-ink">{title}</h3>}
					<button
						type="button"
						onClick={handleClose}
						className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink"
					>
						Close
					</button>
				</div>
				<div className="mt-4">{children}</div>
			</div>
		</div>
	)
}

// Subcomponents expected by callers
export function SheetContent({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={className}>{children}</div>
}

export function SheetHeader({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={className}>{children}</div>
}

export function SheetTitle({ children }: { children: ReactNode }) {
	return <h3 className="font-display text-lg text-ink">{children}</h3>
}
