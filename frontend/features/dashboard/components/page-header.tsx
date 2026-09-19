interface PageHeaderProps {
  title: string
  description?: React.ReactNode
  // Buttons or menus aligned to the end of the row, e.g. a primary action.
  actions?: React.ReactNode
}

// Reusable page title row for dashboard pages: a heading, an optional
// subheading, and an optional cluster of actions. `suppressHydrationWarning`
// on the description lets a prerendered page swap a client-computed value (a
// live date, say) in without a mismatch warning; it is a no-op for static text.
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? (
          <p
            suppressHydrationWarning
            className="mt-0.5 min-h-5 text-sm text-muted-foreground"
          >
            {description}
          </p>
        ) : null}
      </div>

      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}
