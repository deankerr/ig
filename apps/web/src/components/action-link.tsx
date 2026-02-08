export function ActionLink({
  href,
  download,
  onClick,
  children,
}: {
  href?: string
  download?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  const className =
    'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border hover:bg-muted transition-colors'

  if (href) {
    return (
      <a
        href={href}
        target={download ? undefined : '_blank'}
        rel={download ? undefined : 'noopener noreferrer'}
        download={download}
        className={className}
      >
        {children}
      </a>
    )
  }

  return (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  )
}
