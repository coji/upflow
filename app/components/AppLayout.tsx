import type React from 'react'

interface AppLayoutProps {
  header?: React.ReactNode
  children: React.ReactNode
  breadcrumbs?: React.ReactNode
}
const AppLayout = ({ header, breadcrumbs, children }: AppLayoutProps) => {
  return (
    <div
      className={`grid min-h-screen ${
        header ? 'grid-rows-[auto_1fr]' : 'grid-rows-[1fr_auto]'
      }`}
    >
      {header}

      <main className="flex flex-col overflow-auto bg-slate-200 py-2">
        <div className="flex flex-1 flex-col px-4">
          {breadcrumbs}
          <div className="flex-1">{children}</div>
        </div>
      </main>
    </div>
  )
}
AppLayout.displayName = 'AppLayout'
export { AppLayout }
