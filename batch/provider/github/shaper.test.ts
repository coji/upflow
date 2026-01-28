import { describe, expect, test } from 'vitest'
import { shapeGitHubReview } from './shaper'

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
          url: '',
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
            href: '',
          },
          pull_request: {
            href: '',
          },
        },
      }),
    ).toStrictEqual({
      id: 1,
      user: 'coji',
      isBot: false,
      state: 'state',
      url: 'html_url',
      submitted_at: '2022-01-01',
    })
  })

  test('review user is Bot', () => {
    expect(
      shapeGitHubReview({
        id: 1,
        node_id: '1',
        user: {
          login: 'dependabot[bot]',
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
          site_admin: false,
          starred_url: '',
          subscriptions_url: '',
          type: 'Bot',
          url: '',
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
            href: '',
          },
          pull_request: {
            href: '',
          },
        },
      }),
    ).toStrictEqual({
      id: 1,
      user: 'dependabot[bot]',
      isBot: true,
      state: 'state',
      url: 'html_url',
      submitted_at: '2022-01-01',
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
            href: '',
          },
          pull_request: {
            href: '',
          },
        },
      }),
    ).toStrictEqual({
      id: 1,
      user: null,
      isBot: false,
      state: 'state',
      url: 'html_url',
      submitted_at: '2022-01-01',
    })
  })
})
