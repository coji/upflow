import { match } from 'ts-pattern'
import { HStack } from '~/app/components/ui'
import Github from './icons/Github'
import Gitlab from './icons/Gitlab'

interface AppProviderBadgeProps {
  provider: 'github' | 'gitlab' | string
}
export const AppProviderBadge = ({ provider }: AppProviderBadgeProps) => {
  const { label, icon, textClass, borderClass } = match(provider)
    .with('github', () => ({
      label: 'GitHub',
      icon: <Github />,
      textClass: 'text-github',
      borderClass: 'border-github border',
    }))
    .with('gitlab', () => ({
      label: 'GitLab',
      icon: <Gitlab />,
      textClass: 'text-gitlab',
      borderClass: 'border-gitlab border',
    }))
    .otherwise(() => ({
      label: 'Unknown',
      icon: <div>?</div>,
      textClass: 'text-secondary',
      borderClass: 'border-secondary border',
    }))

  return (
    <div className={`inline-block px-2 py-1 ${borderClass} rounded bg-white`}>
      <HStack>
        {icon}
        <p className={`inline ${textClass}`}>{label}</p>
      </HStack>
    </div>
  )
}
