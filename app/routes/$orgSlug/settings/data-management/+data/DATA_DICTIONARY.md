# Upflow PR Export — Data Dictionary

## Overview

This export contains pull request data from Upflow, a development productivity dashboard.
Each row represents **one pull request**. Reviewer information is nested as a JSON array in the `reviewers` column.

## Columns

| Column                    | Type        | Description                                                                                                 |
| ------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| `repo`                    | string      | Repository in `owner/repo` format                                                                           |
| `number`                  | integer     | Pull request number                                                                                         |
| `title`                   | string      | Pull request title                                                                                          |
| `url`                     | string      | GitHub URL                                                                                                  |
| `state`                   | string      | `open`, `closed`, or `merged`                                                                               |
| `author`                  | string      | GitHub login of the PR author                                                                               |
| `source_branch`           | string      | Source (head) branch name                                                                                   |
| `target_branch`           | string      | Target (base) branch name                                                                                   |
| `first_committed_at`      | datetime    | First commit timestamp (ISO 8601 UTC)                                                                       |
| `pull_request_created_at` | datetime    | PR creation timestamp (ISO 8601 UTC)                                                                        |
| `first_reviewed_at`       | datetime?   | First review submission timestamp                                                                           |
| `merged_at`               | datetime?   | Merge timestamp                                                                                             |
| `released_at`             | datetime?   | Release timestamp (based on release detection config)                                                       |
| `coding_time`             | float?      | Time from first commit to first review request when available, otherwise PR creation (days)                 |
| `pickup_time`             | float?      | Time from first review request to first review when available, otherwise PR creation to first review (days) |
| `review_time`             | float?      | Time from first review to merge (days)                                                                      |
| `deploy_time`             | float?      | Time from merge to release (days)                                                                           |
| `total_time`              | float?      | Total cycle time from first commit to release (days)                                                        |
| `additions`               | integer?    | Lines added                                                                                                 |
| `deletions`               | integer?    | Lines deleted                                                                                               |
| `changed_files`           | integer?    | Number of files changed                                                                                     |
| `complexity`              | string?     | AI-classified complexity (e.g., `trivial`, `simple`, `medium`, `complex`, `very_complex`)                   |
| `complexity_reason`       | string?     | AI explanation for complexity classification                                                                |
| `corrected_complexity`    | string?     | Manually corrected complexity (overrides AI)                                                                |
| `author_display_name`     | string?     | Author's display name in the organization                                                                   |
| `author_is_active`        | boolean?    | Whether the author is marked as active                                                                      |
| `team_name`               | string?     | Team the repository belongs to                                                                              |
| `reviewers`               | JSON string | Array of reviewer objects (see below)                                                                       |

### Optional Raw Data Columns (opt-in)

| Column               | Type         | Description                          |
| -------------------- | ------------ | ------------------------------------ |
| `raw_pull_request`   | JSON string? | Raw GitHub Pull Request API response |
| `raw_commits`        | JSON string? | Raw commits data                     |
| `raw_reviews`        | JSON string? | Raw reviews data                     |
| `raw_discussions`    | JSON string? | Raw discussion/comment data          |
| `raw_timeline_items` | JSON string? | Raw timeline events data             |

## Reviewer Object Schema

Each element in the `reviewers` JSON array:

```json
{
  "login": "github-username",
  "display_name": "Display Name",
  "requested_at": "2024-01-15T10:00:00Z",
  "reviewed_at": "2024-01-15T14:30:00Z",
  "state": "APPROVED"
}
```

- `state`: One of `APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`, `DISMISSED`

## Cycle Time Calculation

```text
|-------- coding_time ---------|-- pickup_time --|-- review_time --|-- deploy_time --|
first_committed_at    review_requested_at*    first_reviewed_at  merged_at        released_at
```

- `review_requested_at*` is an internal calculation boundary only. No new export column is added.
- **coding_time**: First commit → First review request, or PR creation when no review request event exists
- **pickup_time**: First review request → First review, or PR creation → First review when no review request event exists
- **review_time**: First review → Merge
- **deploy_time**: Merge → Release
- **total_time**: First commit → Release

All times are measured in **days** (fractional). `null` means the metric could not be calculated (e.g., PR not yet merged).

## Analysis Examples (DuckDB)

### Load the data

```sql
SELECT * FROM read_parquet('data.parquet') LIMIT 5;
```

### Weekly throughput

```sql
SELECT
  date_trunc('week', pull_request_created_at::TIMESTAMP) AS week,
  COUNT(*) AS pr_count,
  ROUND(AVG(total_time), 1) AS avg_cycle_time_days
FROM read_parquet('data.parquet')
WHERE state = 'merged'
GROUP BY week
ORDER BY week DESC;
```

### Complexity distribution

```sql
SELECT
  COALESCE(corrected_complexity, complexity) AS final_complexity,
  COUNT(*) AS count,
  ROUND(AVG(total_time), 1) AS avg_cycle_time
FROM read_parquet('data.parquet')
WHERE state = 'merged'
GROUP BY final_complexity
ORDER BY count DESC;
```

### Reviewer workload

```sql
SELECT
  r.login,
  r.display_name,
  COUNT(*) AS reviews
FROM read_parquet('data.parquet'),
  UNNEST(from_json(reviewers, '["json"]')) AS t(rev),
  UNNEST([json_extract_string(rev, '$.login')]) AS r(login),
  UNNEST([json_extract_string(rev, '$.display_name')]) AS r2(display_name)
WHERE r.login IS NOT NULL
GROUP BY r.login, r.display_name
ORDER BY reviews DESC;
```

### Large PRs with long review times

```sql
SELECT repo, number, title, additions + deletions AS changed_lines,
       ROUND(review_time, 1) AS review_days
FROM read_parquet('data.parquet')
WHERE state = 'merged' AND review_time IS NOT NULL
ORDER BY review_time DESC
LIMIT 20;
```

## Using with Claude Code

Place the exported ZIP in a directory and run:

```bash
claude "Analyze the PR data in data.parquet. Show me weekly cycle time trends and identify bottlenecks."
```

Claude Code can read Parquet files directly with DuckDB or via the Apache Arrow library.
