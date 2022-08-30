import type { CenterProps } from '@chakra-ui/react'
import { Box, Center, Heading } from '@chakra-ui/react'

interface AppCenterFormFrameProps extends CenterProps {
  title: string
  subtitle: string
  children: React.ReactNode
}
export const AppCenterFormFrame = ({ title, subtitle, children, ...rest }: AppCenterFormFrameProps) => (
  <Center flex="1" {...rest}>
    <Box bgColor="white" p={{ base: '2', md: '8' }} width="container.sm" mx="2" rounded="md" boxShadow="md">
      <Heading fontSize="4xl" textAlign="center" color="blue.800" dropShadow="2xl">
        <Box>{title}</Box>
        <Box fontSize="md" fontWeight="normal">
          {subtitle}
        </Box>
      </Heading>

      <Box mx="auto" w="full" maxW="md" px={{ base: '2', md: '8' }} pb={{ base: '2', md: '8' }} mt="4">
        {children}
      </Box>
    </Box>
  </Center>
)
