// Words for the /statechart skill: how a CrawlWatermark state and step read
// to a person. Pass this file as the view when you chart a model.
type Vars = {
  now: number
  listSec: number
  watermark: number
  ghVer: Record<string, number>
  raw: Record<string, { ver: number; fa: number }>
  pend: Record<string, { kind: string }>
  lease: Record<string, { kind: string; phase: string }>
}

const phaseWords: Record<string, string> = {
  list: 'reading the PR list',
  pick: 'fetching PRs',
  read: 'fetching PRs',
  save: 'fetching PRs',
  done: 'finishing',
}
const laneWords: Record<string, string> = {
  sweep: 'Hourly crawl',
  target: 'Webhook crawl',
}

export const title = 'Crawl and the scan watermark'

export const state = (v: Vars) => {
  const run = v.lease.org
  const crawl =
    run.phase === 'none'
      ? 'No crawl running'
      : `${laneWords[run.kind]} ${phaseWords[run.phase]}`
  const waiting = v.pend.org.kind === 'none' ? '' : ', another crawl waiting'
  const page =
    v.lease.page && v.lease.page.phase !== 'none'
      ? ', a PR page refresh running'
      : ''
  const repo =
    v.lease.repo && v.lease.repo.phase !== 'none'
      ? ', the repository-add crawl running'
      : ''
  const stale = Object.keys(v.ghVer).some((p) => v.raw[p].ver !== v.ghVer[p])
  return `${crawl}${waiting}${repo}${page}${stale ? ', a PR row is missing or out of date' : ''}`
}

const whoWords: Record<string, string> = {
  org: 'the crawl',
  repo: 'the repository-add crawl',
  page: 'the PR page refresh',
}
// Which lane took the step: the one whose run record changed.
const who = (from: Vars, to: Vars) => {
  const lane = Object.keys(to.lease).find(
    (k) => JSON.stringify(from.lease[k]) !== JSON.stringify(to.lease[k]),
  )
  return lane ? whoWords[lane] : 'the crawl'
}

export const step = (action: string, from: Vars, to: Vars) => {
  switch (action) {
    case 'Tick':
      return 'a second passes'
    case 'GoQuiet':
      return 'PRs stop changing'
    case 'HourlyTrigger':
      return 'the hourly trigger fires'
    case 'RepoAdded':
      return 'someone adds the repository'
    case 'PageRefresh':
      return 'someone presses refresh on a PR page'
    case 'PrUpdated':
      return from.now === from.listSec
        ? 'someone updates a PR [in the same second as the PR list read]'
        : 'someone updates a PR'
    case 'WebhookHandled':
      return from.pend.org.kind === 'none'
        ? 'the webhook queues a crawl'
        : 'the webhook joins the waiting crawl and its PR number is dropped'
    case 'CrawlStarts':
      return `${who(from, to)} starts`
    case 'PrListFetched':
      return `${who(from, to)} reads the PR list`
    case 'PrFetchBegins':
      return `${who(from, to)} starts fetching a PR and notes the row's fetchedAt`
    case 'PrDetailsRead':
      return `${who(from, to)} reads the PR from GitHub`
    case 'PrDetailsFail':
      return `${who(from, to)} fails to read the PR`
    case 'PrSaved':
      return JSON.stringify(from.raw) === JSON.stringify(to.raw)
        ? `${who(from, to)} tries to save the PR, and the save does not land`
        : `${who(from, to)} saves the PR`
    case 'WatermarkStep':
      return to.watermark !== from.watermark
        ? 'the crawl moves the watermark'
        : 'the crawl leaves the watermark'
    case 'CrawlEnds':
      return `${who(from, to)} ends`
    case 'AllQuiet':
      return null
    default:
      return action
  }
}
