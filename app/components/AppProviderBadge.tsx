import { Box, Stack, Icon, Text } from '@chakra-ui/react'
import { RiGithubFill, RiGitlabFill, RiFileUnknowFill } from 'react-icons/ri'
import { match } from 'ts-pattern'

interface AppProviderBadgeProps {
  provider: 'github' | 'gitlab' | string
}
export const AppProviderBadge = ({ provider }: AppProviderBadgeProps) => {
  const color = match(provider)
    .with('github', () => '#24292e')
    .with('gitlab', () => '#FC6D27')
    .otherwise(() => 'gray')
  return (
    <Box display="inline-block" px="2" py="1" borderWidth="1px" borderColor={color} rounded="md">
      <Stack direction="row" align="center">
        <Icon
          w="8"
          h="8"
          color={color}
          as={match(provider)
            .with('github', () => RiGithubFill)
            .with('gitlab', () => RiGitlabFill)
            .otherwise(() => RiFileUnknowFill)}
        ></Icon>
        <Text display="inline" color={color}>
          {match(provider)
            .with('github', () => 'GitHub')
            .with('gitlab', () => 'GitLab')
            .otherwise(() => 'Unknown')}
        </Text>
      </Stack>
    </Box>
  )
}
