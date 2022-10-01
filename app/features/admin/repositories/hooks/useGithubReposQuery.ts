import { useQuery } from "@tanstack/react-query"
import { listGithubRepos } from "../services/listGithubRepos"
import { sortBy } from "remeda"
//import fixture from "~/../fixture.json"

export const useGithubRepoQuery = (token: string | undefined) =>
  useQuery(["github-repos"], () => listGithubRepos(token ?? ""), {
    enabled: !!token,
    select: (repos) =>
      sortBy(repos, [
        (repo) => repo.pushedAt ?? "2000-01-01T00:00:00Z",
        "desc",
      ]),
  })
