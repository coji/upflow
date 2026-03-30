import { createContext } from 'react-router'
import type { OrgContext } from '~/app/libs/auth.server'

export const orgContext = createContext<OrgContext>()
export const timezoneContext = createContext<string>()
/** Resolved team ID from URL ?team or cookie, validated against org's teams list. null = all teams. */
export const teamContext = createContext<string | null>()
