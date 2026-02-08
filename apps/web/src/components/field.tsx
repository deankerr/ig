export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="mt-1">{children}</div>
    </div>
  )
}
