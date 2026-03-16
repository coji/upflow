import type React from 'react'

export function StatCard({
  value,
  label,
  children,
}: {
  value: string | number
  label: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border p-4 text-center">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-muted-foreground text-sm">{label}</div>
      {children}
    </div>
  )
}
