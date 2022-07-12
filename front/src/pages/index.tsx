import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import { Heading, Container } from '@chakra-ui/react'

const Home: NextPage = () => {
  return (
    <Container maxW="container.lg" mx="auto">
      <Heading>Hello!</Heading>
    </Container>
  )
}

export default Home
