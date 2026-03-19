import { describe, expect, test } from 'vitest'
import type { ShapedGitHubPullRequest } from '../model'
import {
  buildBranchReleaseLookup,
  buildTagReleaseList,
  findReleaseDateFromTags,
} from '../release-detect'

const basePr: ShapedGitHubPullRequest = {
  id: 0,
  organization: 'test-org',
  repo: 'test-repo',
  number: 0,
  state: 'closed',
  title: '',
  body: null,
  url: '',
  author: 'author1',
  authorIsBot: false,
  assignees: [],
  reviewers: [],
  draft: false,
  sourceBranch: 'feature',
  targetBranch: 'main',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  mergedAt: '2024-01-01T00:00:00Z',
  closedAt: '2024-01-01T00:00:00Z',
  mergeCommitSha: 'abc',
  additions: null,
  deletions: null,
  changedFiles: null,
  files: [],
}

function pr(
  number: number,
  source: string,
  target: string,
  mergedAt: string,
  opts?: { state?: 'open' | 'closed'; mergedAt?: null },
): ShapedGitHubPullRequest {
  return {
    ...basePr,
    id: number,
    number,
    sourceBranch: source,
    targetBranch: target,
    mergedAt: opts?.mergedAt === null ? null : mergedAt,
    state: opts?.state ?? 'closed',
    closedAt: opts?.state === 'open' ? null : mergedAt,
  }
}

describe('buildBranchReleaseLookup', () => {
  test('空のPRリスト', () => {
    const result = buildBranchReleaseLookup([], 'main')
    expect(result.size).toBe(0)
  })

  test('直接ターゲット: feature → main', () => {
    const prs = [pr(1, 'feature/login', 'main', '2024-01-10T00:00:00Z')]
    const result = buildBranchReleaseLookup(prs, 'main')
    expect(result.get(1)).toBe('2024-01-10T00:00:00Z')
  })

  test('1-hop: feature → develop → main', () => {
    const prs = [
      pr(1, 'feature/login', 'develop', '2024-01-10T00:00:00Z'),
      pr(2, 'develop', 'main', '2024-01-20T00:00:00Z'),
    ]
    const result = buildBranchReleaseLookup(prs, 'main')
    expect(result.get(1)).toBe('2024-01-20T00:00:00Z')
    expect(result.get(2)).toBe('2024-01-20T00:00:00Z')
  })

  test('多段 (2-hop): feature → develop → staging → main', () => {
    const prs = [
      pr(1, 'feature/login', 'develop', '2024-01-10T00:00:00Z'),
      pr(2, 'develop', 'staging', '2024-01-15T00:00:00Z'),
      pr(3, 'staging', 'main', '2024-01-20T00:00:00Z'),
    ]
    const result = buildBranchReleaseLookup(prs, 'main')
    expect(result.get(1)).toBe('2024-01-20T00:00:00Z')
    expect(result.get(2)).toBe('2024-01-20T00:00:00Z')
    expect(result.get(3)).toBe('2024-01-20T00:00:00Z')
  })

  test('定期リリース: feature1は1回目、feature2は2回目のリリースに割り当て', () => {
    const prs = [
      pr(1, 'feature1', 'develop', '2024-01-05T00:00:00Z'),
      pr(2, 'feature2', 'develop', '2024-01-15T00:00:00Z'),
      pr(3, 'develop', 'main', '2024-01-10T00:00:00Z'), // リリース1
      pr(4, 'develop', 'main', '2024-01-20T00:00:00Z'), // リリース2
    ]
    const result = buildBranchReleaseLookup(prs, 'main')
    expect(result.get(1)).toBe('2024-01-10T00:00:00Z')
    expect(result.get(2)).toBe('2024-01-20T00:00:00Z')
  })

  test('未リリース: リリースPRがfeatureマージより前', () => {
    const prs = [
      pr(1, 'feature', 'develop', '2024-01-15T00:00:00Z'),
      pr(2, 'develop', 'main', '2024-01-10T00:00:00Z'),
    ]
    const result = buildBranchReleaseLookup(prs, 'main')
    expect(result.get(1)).toBeUndefined()
  })

  test('時系列不整合: featureがリリース後にマージ → null', () => {
    const prs = [
      pr(1, 'feature', 'develop', '2024-01-25T00:00:00Z'),
      pr(2, 'develop', 'main', '2024-01-20T00:00:00Z'),
    ]
    const result = buildBranchReleaseLookup(prs, 'main')
    expect(result.get(1)).toBeUndefined()
  })

  test('複数パス到達: Y経由が最速パス', () => {
    const prs = [
      pr(1, 'feature', 'A', '2024-01-05T00:00:00Z'),
      pr(2, 'A', 'X', '2024-01-10T00:00:00Z'),
      pr(3, 'A', 'Y', '2024-01-11T00:00:00Z'),
      pr(4, 'X', 'B', '2024-02-01T00:00:00Z'),
      pr(5, 'Y', 'B', '2024-01-20T00:00:00Z'),
      pr(6, 'B', 'main', '2024-01-25T00:00:00Z'),
      pr(7, 'B', 'main', '2024-02-05T00:00:00Z'),
    ]
    const result = buildBranchReleaseLookup(prs, 'main')
    expect(result.get(1)).toBe('2024-01-25T00:00:00Z')
  })

  test('循環防止: A → B → A → B のような循環があっても無限ループしない', () => {
    const prs = [
      pr(1, 'feature', 'A', '2024-01-05T00:00:00Z'),
      pr(2, 'A', 'B', '2024-01-10T00:00:00Z'),
      pr(3, 'B', 'A', '2024-01-15T00:00:00Z'),
      pr(4, 'A', 'B', '2024-01-20T00:00:00Z'),
      // main には到達しない
    ]
    const result = buildBranchReleaseLookup(prs, 'main')
    expect(result.get(1)).toBeUndefined()
  })

  test('open PR は無視される', () => {
    const prs = [
      pr(1, 'feature', 'develop', '2024-01-10T00:00:00Z', {
        state: 'open',
        mergedAt: null,
      }),
      pr(2, 'develop', 'main', '2024-01-20T00:00:00Z'),
    ]
    const result = buildBranchReleaseLookup(prs, 'main')
    expect(result.get(1)).toBeUndefined()
  })

  test('release PR 自身の releasedAt = mergedAt', () => {
    const prs = [
      pr(1, 'feature', 'develop', '2024-01-10T00:00:00Z'),
      pr(2, 'develop', 'main', '2024-01-20T00:00:00Z'),
    ]
    const result = buildBranchReleaseLookup(prs, 'main')
    // release PR (develop → main) 自身も releasedAt を持つ
    expect(result.get(2)).toBe('2024-01-20T00:00:00Z')
  })

  test('マージ方式に依存しない（SHA を使わない）', () => {
    // squash merge: mergeCommitSha が異なっても動作する
    const prs = [
      {
        ...pr(1, 'feature', 'develop', '2024-01-10T00:00:00Z'),
        mergeCommitSha: 'squash-sha-1',
      },
      {
        ...pr(2, 'develop', 'main', '2024-01-20T00:00:00Z'),
        mergeCommitSha: 'squash-sha-2',
      },
    ]
    const result = buildBranchReleaseLookup(prs, 'main')
    expect(result.get(1)).toBe('2024-01-20T00:00:00Z')
  })

  test('回帰: squash merge で直接ターゲット (Issue #161)', () => {
    // Issue #161 の再現: feature → main を squash merge した場合
    // 旧実装 (SHA方式) では mergeCommitSha が commits 一覧に含まれず releasedAt = null になっていた
    const prs = [
      {
        ...pr(1, 'feature/login', 'main', '2024-01-10T00:00:00Z'),
        mergeCommitSha: 'squash-sha-not-in-commits',
      },
      {
        ...pr(2, 'feature/auth', 'main', '2024-01-12T00:00:00Z'),
        mergeCommitSha: null, // rebase merge ではnullの場合もある
      },
    ]
    const result = buildBranchReleaseLookup(prs, 'main')
    // ブランチ方式なので SHA に関係なくリリース検出される
    expect(result.get(1)).toBe('2024-01-10T00:00:00Z')
    expect(result.get(2)).toBe('2024-01-12T00:00:00Z')
  })
})

describe('buildTagReleaseList', () => {
  test('正規表現でタグをフィルタし、committedAt 昇順で返す', async () => {
    const result = await buildTagReleaseList(
      {
        tags: async () => [
          {
            name: 'v2.0.0',
            sha: 'sha-2',
            committedAt: '2024-02-01T00:00:00Z',
          },
          {
            name: 'nightly-2024-01-15',
            sha: 'sha-nightly',
            committedAt: '2024-01-15T00:00:00Z',
          },
          {
            name: 'v1.0.0',
            sha: 'sha-1',
            committedAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
      '^v\\d+\\.\\d+\\.\\d+$',
    )

    expect(result).toEqual([
      { name: 'v1.0.0', sha: 'sha-1', committedAt: '2024-01-01T00:00:00Z' },
      { name: 'v2.0.0', sha: 'sha-2', committedAt: '2024-02-01T00:00:00Z' },
    ])
  })

  test('無効な正規表現では空配列を返す', async () => {
    const result = await buildTagReleaseList(
      {
        tags: async () => [
          { name: 'v1.0.0', sha: 'sha-1', committedAt: '2024-01-01T00:00:00Z' },
        ],
      },
      '[',
    )

    expect(result).toEqual([])
  })

  test('長すぎるパターンでは空配列を返す', async () => {
    const result = await buildTagReleaseList(
      {
        tags: async () => [
          { name: 'v1.0.0', sha: 'sha-1', committedAt: '2024-01-01T00:00:00Z' },
        ],
      },
      'a'.repeat(201),
    )

    expect(result).toEqual([])
  })
})

describe('findReleaseDateFromTags', () => {
  const sortedTags = [
    { committedAt: '2024-01-10T00:00:00Z' },
    { committedAt: '2024-01-20T00:00:00Z' },
    { committedAt: '2024-01-30T00:00:00Z' },
  ]

  test('mergedAt 以降の最初のタグを返す', () => {
    expect(findReleaseDateFromTags('2024-01-15T00:00:00Z', sortedTags)).toBe(
      '2024-01-20T00:00:00Z',
    )
  })

  test('mergedAt 以降のタグがない場合は null を返す', () => {
    expect(
      findReleaseDateFromTags('2024-02-01T00:00:00Z', sortedTags),
    ).toBeNull()
  })

  test('mergedAt と同時刻のタグを返す', () => {
    expect(findReleaseDateFromTags('2024-01-20T00:00:00Z', sortedTags)).toBe(
      '2024-01-20T00:00:00Z',
    )
  })

  test('空のタグリストでは null を返す', () => {
    expect(findReleaseDateFromTags('2024-01-01T00:00:00Z', [])).toBeNull()
  })
})
