import { RiFileUnknowFill, RiGithubFill, RiGitlabFill } from 'react-icons/ri/index.js'
import { match } from 'ts-pattern'
import { HStack } from '~/app/components/ui'

interface AppProviderBadgeProps {
  provider: 'github' | 'gitlab' | string
}
export const AppProviderBadge = ({ provider }: AppProviderBadgeProps) => {
  const { label, icon, textClass, borderClass } = match(provider)
    .with('github', () => ({
      label: 'GitHub',
      icon: <RiGithubFill className="block text-github" />,
      textClass: 'text-github',
      borderClass: 'border-github border',
    }))
    .with('gitlab', () => ({
      label: 'GitLab',
      icon: <RiGitlabFill className="block text-gitlab" />,
      textClass: 'text-gitlab',
      borderClass: 'border-gitlab border',
    }))
    .otherwise(() => ({
      label: 'Unknown',
      icon: <RiFileUnknowFill className="block text-secondary" />,
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
