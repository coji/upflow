import type {
  Company,
  Integration,
  PullRequest,
  Repository,
} from '@prisma/client'
import invariant from 'tiny-invariant'
import { crawlerDb } from '~/batch/db/crawler-db.server'
import { logger } from '~/batch/helper/logger'
import { createPathBuilder } from '../../helper/path-builder'
import { createAggregator } from './aggregator'
import { createFetcher } from './fetcher'
import {
  ShapedGitHubCommit,
  ShapedGitHubIssueComment,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubTag,
} from './model'
import { buildPullRequests } from './pullrequest'
import { createStore } from './store'

const upsertPullRequest = async (
  db: ReturnType<typeof crawlerDb>,
  repositoryId: string,
  pr: ShapedGitHubPullRequest,
) => {
  try {
    await db
      .insertInto('pull_requests')
      .values({
        repo_id: repositoryId,
        id: pr.id,
        organization: pr.organization,
        repo: pr.repo,
        number: pr.number,
        state: pr.state,
        url: pr.url,
        author: pr.author,
        assignees: JSON.stringify(pr.assignees),
        reviewers: JSON.stringify(pr.reviewers),
        draft: pr.draft,
        title: pr.title,
        source_branch: pr.source_branch,
        target_branch: pr.target_branch,
        merged_at: pr.merged_at,
        merge_commit_sha: pr.merge_commit_sha,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
      })
      .onConflict((oc) =>
        oc.columns(['repo_id', 'id']).doUpdateSet({
          organization: (eb) => eb.ref('excluded.organization'),
          repo: (eb) => eb.ref('excluded.repo'),
          number: (eb) => eb.ref('excluded.number'),
          state: (eb) => eb.ref('excluded.state'),
          url: (eb) => eb.ref('excluded.url'),
          author: (eb) => eb.ref('excluded.author'),
          assignees: (eb) => eb.ref('excluded.assignees'),
          reviewers: (eb) => eb.ref('excluded.reviewers'),
          title: (eb) => eb.ref('excluded.title'),
          source_branch: (eb) => eb.ref('excluded.source_branch'),
          target_branch: (eb) => eb.ref('excluded.target_branch'),
          merged_at: (eb) => eb.ref('excluded.merged_at'),
          merge_commit_sha: (eb) => eb.ref('excluded.merge_commit_sha'),
          created_at: (eb) => eb.ref('excluded.created_at'),
          updated_at: (eb) => eb.ref('excluded.updated_at'),
        }),
      )
      .execute()
  } catch (e) {
    console.log(e)
  }
}

const upsertTag = async (
  db: ReturnType<typeof crawlerDb>,
  repositoryId: string,
  tag: ShapedGitHubTag,
) => {
  try {
    await db
      .insertInto('tags')
      .values({
        repo_id: repositoryId,
        name: tag.name,
        sha: tag.sha,
        committed_at: tag.committed_at,
      })
      .onConflict((oc) =>
        oc.columns(['repo_id', 'name']).doUpdateSet({
          sha: (eb) => eb.ref('excluded.sha'),
          committed_at: (eb) => eb.ref('excluded.committed_at'),
        }),
      )
      .execute()
  } catch (e) {
    console.log(e)
  }
}

const upsertCommit = async (
  db: ReturnType<typeof crawlerDb>,
  repositoryId: string,
  pull_request_id: number,
  commit: ShapedGitHubCommit,
) => {
  try {
    await db
      .insertInto('commits')
      .values({ repo_id: repositoryId, pull_request_id, ...commit })
      .onConflict((oc) =>
        oc.columns(['repo_id', 'pull_request_id', 'sha']).doUpdateSet({
          url: (eb) => eb.ref('excluded.url'),
          committer: (eb) => eb.ref('excluded.committer'),
          date: (eb) => eb.ref('excluded.date'),
        }),
      )
      .execute()
  } catch (e) {
    console.log(e)
  }
}

const upsertIssueComment = async (
  db: ReturnType<typeof crawlerDb>,
  repositoryId: string,
  pull_request_id: number,
  reviewComment: ShapedGitHubIssueComment,
) => {
  try {
    await db
      .insertInto('issue_comments')
      .values({
        repo_id: repositoryId,
        pull_request_id,
        id: reviewComment.id,
        user: reviewComment.user,
        url: reviewComment.url,
        created_at: reviewComment.created_at,
      })
      .onConflict((oc) =>
        oc.columns(['repo_id', 'pull_request_id', 'id']).doUpdateSet({
          user: (eb) => eb.ref('excluded.user'),
          url: (eb) => eb.ref('excluded.url'),
          created_at: (eb) => eb.ref('excluded.created_at'),
        }),
      )
      .execute()
  } catch (e) {
    console.log(e)
  }
}

const upsertReview = async (
  db: ReturnType<typeof crawlerDb>,
  repositoryId: string,
  pull_request_id: number,
  review: ShapedGitHubReview,
) => {
  try {
    await db
      .insertInto('reviews')
      .values({
        repo_id: repositoryId,
        pull_request_id,
        ...review,
      })
      .onConflict((oc) =>
        oc.columns(['repo_id', 'pull_request_id', 'id']).doUpdateSet({
          user: (eb) => eb.ref('excluded.user'),
          state: (eb) => eb.ref('excluded.state'),
          url: (eb) => eb.ref('excluded.url'),
          submitted_at: (eb) => eb.ref('excluded.submitted_at'),
        }),
      )
      .execute()
  } catch (e) {
    console.log(e)
  }
}

export const createGitHubProvider = (integration: Integration) => {
  interface FetchOptions {
    refresh?: boolean
    halt?: boolean
    delay?: number
  }
  const fetch = async (
    repository: Repository,
    { refresh = false, halt = false, delay = 0 }: FetchOptions,
  ) => {
    invariant(repository.repo, 'private token not specified')
    invariant(repository.owner, 'private token not specified')
    invariant(integration.privateToken, 'private token not specified')

    const fetcher = createFetcher({
      owner: repository.owner,
      repo: repository.repo,
      token: integration.privateToken,
      delay,
    })
    const aggregator = createAggregator()
    const store = createStore({
      companyId: repository.companyId,
      repositoryId: repository.id,
    })
    const pathBuilder = createPathBuilder({
      companyId: repository.companyId,
      repositoryId: repository.id,
    })

    logger.info('fetch started: ', repository.name)
    logger.info('path: ', pathBuilder.jsonPath(''))

    // PR の最終更新日時を起点とする
    const leastMergeRequest = aggregator.leastUpdatedPullRequest(
      await store.loader.pullrequests().catch(() => []),
    )
    const lastFetchedAt =
      leastMergeRequest?.updated_at ?? '2000-01-01T00:00:00Z'
    logger.info(`last fetched at: ${lastFetchedAt}`)

    // 全プルリク情報をダウンロード
    logger.info('fetching all pullrequests...')
    const allPullRequests = await fetcher.pullrequests()

    // const db = crawlerDb(repository.companyId)
    try {
      // for (const pr of allPullRequests) {
      //   await upsertPullRequest(db, repository.id, pr)
      // }
      logger.info('fetching all pullrequests completed.')

      // 全タグを情報をダウンロード
      if (repository.releaseDetectionMethod === 'tags') {
        logger.info('fetching all tags...')
        const allTags = await fetcher.tags()
        await store.save('tags.json', allTags)
        // for (const tag of allTags) {
        //   await upsertTag(db, repository.id, tag)
        // }

        logger.info('fetching all tags completed.')
      }

      // 個別のPR
      for (const pr of allPullRequests) {
        if (halt) {
          logger.fatal('halted')
          return
        }

        const isUpdated = pr.updated_at > lastFetchedAt
        // 前回以前fetchしたときから更新されていないPRの場合はスキップ
        if (!refresh && !isUpdated) {
          logger.debug('skip', pr.number, pr.state, pr.updated_at)
          continue
        }

        // 個別PRの全コミット
        logger.info(`${pr.number} commits`)
        const allCommits = await fetcher.commits(pr.number)
        await store.save(store.path.commitsJsonFilename(pr.number), allCommits)
        // for (const commit of allCommits) {
        //   await upsertCommit(db, repository.id, pr.id, commit)
        // }

        // 個別PRのレビューコメント
        logger.info(`${pr.number} review comments`)
        const discussions = await fetcher.comments(pr.number)
        await store.save(
          store.path.discussionsJsonFilename(pr.number),
          discussions,
        )
        // for (const reviewComment of discussions) {
        //   await upsertIssueComment(db, repository.id, pr.id, reviewComment)
        // }

        // 個別PRのレビュー
        logger.info(`${pr.number} reviews`)
        const reviews = await fetcher.reviews(pr.number)
        await store.save(store.path.reviewJsonFilename(pr.number), reviews)
        // for (const review of reviews) {
        //   await upsertReview(db, repository.id, pr.id, review)
        // }
      }

      // 全プルリク情報を保存
      await store.save('pullrequests.json', allPullRequests)
      logger.info('fetch completed: ', repository.name)

      // duckdb の wal が残ってしまうので明示的に閉じる
      // await sql`CHECKPOINT`.execute(db)
    } finally {
      // await db.destroy()
    }
  }

  const analyze = async (company: Company, repositories: Repository[]) => {
    let allPulls: PullRequest[] = []
    let allReviewResponses: {
      repo: string
      number: string
      author: string
      createdAt: string
      responseTime: number
    }[] = []

    for (const repository of repositories) {
      const store = createStore({
        companyId: repository.companyId,
        repositoryId: repository.id,
      })
      const { pulls, reviewResponses } = await buildPullRequests(
        {
          companyId: repository.companyId,
          repositoryId: repository.id,
          releaseDetectionMethod:
            repository.releaseDetectionMethod ?? company.releaseDetectionMethod,
          releaseDetectionKey:
            repository.releaseDetectionKey ?? company.releaseDetectionKey,
        },
        await store.loader.pullrequests(),
      )
      allPulls = [...allPulls, ...pulls]
      allReviewResponses = [...allReviewResponses, ...reviewResponses]
    }
    return { pulls: allPulls, reviewResponses: allReviewResponses }
  }

  return {
    fetch,
    analyze,
  }
}
