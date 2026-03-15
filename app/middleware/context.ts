import { createContext } from 'react-router'
import type { OrgContext } from '~/app/libs/auth.server'

export const orgContext = createContext<OrgContext>()
export const timezoneContext = createContext<string>()
