import { RiFileUnknowFill, RiGithubFill, RiGitlabFill } from 'react-icons/ri'
import { match } from 'ts-pattern'
import { HStack } from '~/app/components/ui'

interface AppProviderBadgeProps {
  provider: 'github' | 'gitlab' | string
}
export const AppProviderBadge = ({ provider }: AppProviderBadgeProps) => {
  const { label, icon, textClass, borderClass } = match(provider)
    .with('github', () => ({
      label: 'GitHub',
      icon: <RiGithubFill className="block text-[#24292e]" />,
      textClass: 'text-[#24292e]',
      borderClass: 'border-[#24292e] border',
    }))
    .with('gitlab', () => ({
      label: 'GitLab',
      icon: <RiGitlabFill className="block text-[#FC6D27]" />,
      textClass: 'text-[#FC6D27]',
      borderClass: 'border-[#FC6D27] border',
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
