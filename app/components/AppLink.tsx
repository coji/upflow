import type { LinkProps as ChakraLinkProps } from '@chakra-ui/react'
import { Link as ChakraLink } from '@chakra-ui/react'
import type { LinkProps as RemixLinkProps } from '@remix-run/react'
import { Link as RemixLink } from '@remix-run/react'
import React from 'react'

const AppLink = React.forwardRef((props: Omit<RemixLinkProps, 'color'> & ChakraLinkProps, ref) => (
  <ChakraLink as={RemixLink} _hover={{ textDecoration: 'none' }} {...props} ref={ref} />
))
AppLink.displayName = 'AppLink'
export { AppLink }
