import { useQuery } from 'react-query'
import ky from 'ky'
import { MergeRequest } from '@prisma/client'

export const useMergeRequests = () => useQuery(['mergerequests'], async () => ky.get('/api/mergerequests/list').json<{ items: MergeRequest[] }>())
