import { describe, expect, test } from 'vitest'
import { HIDDEN_PR_REASONS } from '~/app/libs/hidden-prs'
import { setReasonHidden } from './hidden-prs-menu'

const apply = (
  search: string,
  ...changes: [Parameters<typeof setReasonHidden>[1], boolean][]
) =>
  changes
    .reduce(
      (params, [reason, hidden]) => setReasonHidden(params, reason, hidden),
      new URLSearchParams(search),
    )
    .toString()

describe('setReasonHidden', () => {
  test('PR types are shown by adding them to ?prTypes= and hidden by removing them', () => {
    expect(apply('', ['release', false])).toBe('prTypes=release')
    expect(apply('', ['dependency', false], ['release', false])).toBe(
      'prTypes=release%2Cdependency',
    )
    expect(apply('prTypes=release', ['release', true])).toBe('')
  })

  test('drafts are hidden with ?hideDrafts=1', () => {
    expect(apply('', ['draft', true])).toBe('hideDrafts=1')
    expect(apply('hideDrafts=1', ['draft', false])).toBe('')
  })

  test('title/branch filters are shown with ?showFiltered=1', () => {
    expect(apply('', ['filter', false])).toBe('showFiltered=1')
    expect(apply('showFiltered=1', ['filter', true])).toBe('')
  })

  test('showing every reason reveals everything and keeps other params', () => {
    const params = HIDDEN_PR_REASONS.reduce(
      (p, reason) => setReasonHidden(p, reason, false),
      new URLSearchParams('team=a&hideDrafts=1'),
    )
    expect(Object.fromEntries(params)).toEqual({
      team: 'a',
      prTypes: 'release,template-merge,dependency',
      showFiltered: '1',
    })
  })
})
