GitLab merge request fetch and reporter

# Quick start

First, clone this repository and set configuration on .env file (e.g. see .env.default)

```
PROJECT_ID=<Your GitLab.com Project ID>
PRIVATE_TOKEN=<Your GitLab.com Private Token>
```

Next, install dependencies.

```
pnpm i
```

That's all you need to know to start! 🎉

# Usage

## Fetch

```
pnpm tsx batch/cycletime fetch
```

Command for fetch merge requests, related commits and discussion.
They are stored in `scripts/json`.

## Report

```
pnpm tsx batch/cycletime report
```

Command for make a report in tsv format.

## Review

```
pnpm tsx batch/cycletime review <mergerequest iid>
```

Command for show review comments with the given merge request id.
