import type { NextPage } from 'next'
import { Box, Heading, Container, Stack } from '@chakra-ui/react'
import { useMergeRequests } from '~/features/mergerequests/hooks/useMergeRequests'

const Home: NextPage = () => {
  const { data } = useMergeRequests()

  return (
    <Container maxW="container.lg" mx="auto">
      <Heading>Hello!</Heading>
      {data && (
        <Stack>
          {data.items.map((item) => (
            <Box key={item.id}>
              {item.id}
              {item.title}
              {item.author}
            </Box>
          ))}
        </Stack>
      )}
    </Container>
  )
}

export default Home
