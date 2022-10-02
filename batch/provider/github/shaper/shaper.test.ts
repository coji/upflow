import { describe, test, expect } from 'vitest'
import { shapeGitHubReview } from './index'

describe('shapeGitHubReview', () => {
  test('review user is not null', () => {
    expect(
      shapeGitHubReview({
        id: 1,
        node_id: '1',
        user: {
          login: 'coji',
          avatar_url: '',
          events_url: '',
          followers_url: '',
          following_url: '',
          gists_url: '',
          gravatar_id: '',
          html_url: '',
          id: 1,
          node_id: '',
          organizations_url: '',
          received_events_url: '',
          repos_url: '',
          site_admin: true,
          starred_url: '',
          subscriptions_url: '',
          type: '',
          url: ''
        },
        author_association: 'MEMBER',
        body: '',
        commit_id: '',
        html_url: 'html_url',
        pull_request_url: '',
        state: 'state',
        submitted_at: '2022-01-01',
        _links: {
          html: {
            href: ''
          },
          pull_request: {
            href: ''
          }
        }
      })
    ).toStrictEqual({
      id: 1,
      user: 'coji',
      state: 'state',
      url: 'html_url',
      submittedAt: '2022-01-01'
    })
  })

  test('review user is null', () => {
    expect(
      shapeGitHubReview({
        id: 1,
        node_id: '1',
        user: null,
        author_association: 'MEMBER',
        body: '',
        commit_id: '',
        html_url: 'html_url',
        pull_request_url: '',
        state: 'state',
        submitted_at: '2022-01-01',
        _links: {
          html: {
            href: ''
          },
          pull_request: {
            href: ''
          }
        }
      })
    ).toStrictEqual({
      id: 1,
      user: null,
      state: 'state',
      url: 'html_url',
      submittedAt: '2022-01-01'
    })
  })
})
