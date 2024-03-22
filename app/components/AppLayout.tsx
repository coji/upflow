import type React from 'react'
import { useBreadcrumbs } from '~/app/hooks/AppBreadcrumbs'

interface AppLayoutProps {
  header?: React.ReactNode
  children: React.ReactNode
}
const AppLayout = ({ header, children }: AppLayoutProps) => {
  const { AppBreadcrumbs } = useBreadcrumbs()

  return (
    <div
      className={`grid min-h-screen ${
        header ? 'grid-rows-[auto_1fr_auto]' : 'grid-rows-[1fr_auto]'
      }`}
    >
      {header}

      <main className="max-w-screen flex flex-col overflow-auto bg-gray-200 pb-2 md:px-0">
        <div className="flex flex-1 flex-col px-2 md:container">
          <AppBreadcrumbs />
          <div className="flex-1">{children}</div>
        </div>
      </main>

      <footer className="p-2 text-center text-sm shadow">
        Copyright&copy;{' '}
        <a
          href="https://www.techtalk.jp/"
          target="_blank"
          rel="noreferrer"
          className="hover:text-primary hover:underline"
        >
          TechTalk Inc.
        </a>
      </footer>
    </div>
  )
}
AppLayout.displayName = 'AppLayout'
export { AppLayout }
