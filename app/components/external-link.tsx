import type { ComponentProps } from 'react'

/**
 * Anchor that opens its target in a new tab with secure rel attributes
 * applied. Centralises the `target="_blank" rel="noopener noreferrer"` pair
 * so consumers can't forget either half.
 */
export function ExternalLink({ children, ...props }: ComponentProps<'a'>) {
  return (
    <a target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  )
}
