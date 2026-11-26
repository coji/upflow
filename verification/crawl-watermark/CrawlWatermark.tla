---------------------------- MODULE CrawlWatermark ----------------------------
(***************************************************************************)
(* A model of how the crawl job keeps githubRawData in step with GitHub    *)
(* for one repository, and of the scan watermark that bounds full sweeps.  *)
(*                                                                         *)
(* Promise checked (Converged): once PRs stop changing, webhooks are       *)
(* delivered and one hourly sweep has finished after that, every PR's row  *)
(* in githubRawData holds GitHub's latest version of that PR.              *)
(*                                                                         *)
(* Every action names the code it stands for.  See .agents/skills/       *)
(* verify-crawl-watermark/SKILL.md for the coverage table and the commit *)
(* at which this was last confirmed.                                      *)
(***************************************************************************)
EXTENDS Integers, FiniteSets

CONSTANTS
    PRs,                  \* PR numbers in the one repository
    MaxTime,              \* last GitHub second the model reaches
    MaxUpdates,           \* PR updates on GitHub before things go quiet
    MaxFails,             \* fetch-pr steps that fail (network, 5xx)
    MaxHourly,            \* hourly triggers before things go quiet
    Workers,              \* durably worker processes on data/durably.db (each runs one run)
    \* --- switches that mirror a choice in the code (see check.sh) ---
    StopInclusive,        \* fetcher.ts pullrequestList: stop when node.updatedAt <= stopBefore
    AdvanceNeedsAllSaved, \* scan-watermark.ts: no advance unless every listed PR was saved
    TargetedNeverAdvances,\* scan-watermark.ts: a targeted (webhook) fetch never advances
    SaveGuard,            \* store.ts savePrData: keep the row when its fetchedAt is newer
    \* --- switches for conditions outside the code ---
    SameSecondUpdates,    \* a PR can change in the same GitHub second as a PR list read
    WithRepoAdd,          \* the repository is added while things run (repositories.add crawl)
    WithPageRefresh,      \* someone presses refresh on a PR page ($pull/index.tsx), once
    PartialListing        \* GitHub returns a list page with null nodes (GraphQL partial error)

None == -1                \* repositories.scanWatermark IS NULL -> FETCH_ALL_SENTINEL
\* "org": crawlConcurrencyKey(org), "repo": crawlRepoConcurrencyKey(org, repo).
\* "page": the PR page refresh action, which runs in the request, outside durably.
Keys == {"org", "repo", "page"}
CrawlKeys == {"org", "repo"}
NoPend == [kind |-> "none", tgt |-> 0]
NoRun == [kind |-> "none", tgt |-> 0, phase |-> "none", inc |-> FALSE, wm |-> None,
          listed |-> {}, todo |-> {}, cur |-> 0, fa |-> 0, rv |-> 0,
          saved |-> {}, q |-> FALSE, full |-> TRUE]

VARIABLES
    now,        \* GitHub clock, whole seconds (updatedAt has second resolution)
    ghVer,      \* GitHub: current version of each PR
    ghUpd,      \* GitHub: updatedAt of each PR
    raw,        \* githubRawData row: [ver, fa] (ver 0 = no row, fa = fetchedAt)
    seen,       \* highest version ever written to each row (for RawNeverGoesBack)
    watermark,  \* repositories.scanWatermark
    fclock,     \* new Date() used for fetchedAt; strictly increasing
    listSec,    \* GitHub second of the latest PR list read (for SameSecondUpdates)
    hooks,      \* pull_request webhooks sent by GitHub, not yet handled
    pend,       \* durably: the one pending crawl run per concurrency key
    lease,      \* durably: the running crawl run per concurrency key
    repoAdded,  \* the repository row exists in the tenant DB
    quiet,      \* no more PR updates will happen
    finalDone,  \* an org sweep that started after quiet finished with no failed
                \* fetch and a complete PR list from GitHub
    updates, fails, hourly, pages

vars == <<now, ghVer, ghUpd, raw, seen, watermark, fclock, listSec, hooks, pend, lease,
          repoAdded, quiet, finalDone, updates, fails, hourly, pages>>

Max(S) == CHOOSE x \in S : \A y \in S : y <= x

Init ==
    /\ now = 0
    /\ ghVer = [p \in PRs |-> 1]
    /\ ghUpd = [p \in PRs |-> 0]
    /\ raw = [p \in PRs |-> [ver |-> 0, fa |-> 0]]
    /\ seen = [p \in PRs |-> 0]
    /\ watermark = None
    /\ fclock = 0
    /\ listSec = -1
    /\ hooks = {}
    /\ pend = [k \in Keys |-> NoPend]
    /\ lease = [k \in Keys |-> NoRun]
    /\ repoAdded = ~WithRepoAdd
    /\ quiet = FALSE
    /\ finalDone = FALSE
    /\ updates = 0 /\ fails = 0 /\ hourly = 0 /\ pages = 0

(* durably trigger with a concurrencyKey (node_modules/@coji/durably 0.16.1,  *)
(* docs/llms.md "With coalesce"): when a pending run exists for the key, a    *)
(* trigger with coalesce returns it and drops its own input; one without      *)
(* coalesce throws ConflictError, which the caller logs.  Either way nothing  *)
(* new is queued.  Otherwise a new pending run is created, even while a run   *)
(* with the key is leased.                                                    *)
Trigger(k, kind, tgt) ==
    IF pend[k].kind # "none"
    THEN UNCHANGED pend
    ELSE pend' = [pend EXCEPT ![k] = [kind |-> kind, tgt |-> tgt]]

Run(k) == lease[k]
Set(k, r) == lease' = [lease EXCEPT ![k] = r]

---------------------------------------------------------------------------
(* The world *)

Tick == now < MaxTime /\ now' = now + 1
        /\ UNCHANGED <<ghVer, ghUpd, raw, seen, watermark, fclock, listSec, hooks, pend, lease,
                       repoAdded, quiet, finalDone, updates, fails, hourly, pages>>

\* Someone pushes, reviews or comments: GitHub bumps updatedAt and sends a webhook.
PrUpdated(p) ==
    /\ ~quiet /\ updates < MaxUpdates
    /\ SameSecondUpdates \/ now > listSec
    /\ ghVer' = [ghVer EXCEPT ![p] = @ + 1]
    /\ ghUpd' = [ghUpd EXCEPT ![p] = now]
    /\ hooks' = hooks \cup {p}
    /\ updates' = updates + 1
    /\ UNCHANGED <<now, raw, seen, watermark, fclock, listSec, pend, lease, repoAdded, quiet,
                   finalDone, fails, hourly, pages>>

GoQuiet == ~quiet /\ quiet' = TRUE
        /\ UNCHANGED <<now, ghVer, ghUpd, raw, seen, watermark, fclock, listSec, hooks, pend, lease,
                       repoAdded, finalDone, updates, fails, hourly, pages>>

---------------------------------------------------------------------------
(* Triggers *)

\* github-webhook-pull.server.ts: crawl {repositoryId, prNumbers:[p]} on
\* crawlConcurrencyKey, coalesce 'skip'.  No tenant repository -> dropped.
WebhookHandled(p) ==
    /\ p \in hooks
    /\ hooks' = hooks \ {p}
    /\ IF repoAdded THEN Trigger("org", "target", p) ELSE UNCHANGED pend
    /\ UNCHANGED <<now, ghVer, ghUpd, raw, seen, watermark, fclock, listSec, lease, repoAdded,
                   quiet, finalDone, updates, fails, hourly, pages>>

\* job-scheduler.ts: crawl {refresh:false} on crawlConcurrencyKey, no coalesce.
HourlyTrigger ==
    /\ \/ ~quiet /\ hourly < MaxHourly /\ hourly' = hourly + 1
       \/ quiet /\ ~finalDone /\ UNCHANGED hourly
    /\ Trigger("org", "sweep", 0)
    /\ UNCHANGED <<now, ghVer, ghUpd, raw, seen, watermark, fclock, listSec, hooks, lease,
                   repoAdded, quiet, finalDone, updates, fails, pages>>

\* repositories.add/index.tsx: insert the repository, then crawl {repositoryId}
\* on crawlRepoConcurrencyKey, coalesce 'skip'.  A sweep, not a targeted fetch.
RepoAdded ==
    /\ WithRepoAdd /\ ~repoAdded
    /\ repoAdded' = TRUE
    /\ Trigger("repo", "sweep", 0)
    /\ UNCHANGED <<now, ghVer, ghUpd, raw, seen, watermark, fclock, listSec, hooks, lease,
                   quiet, finalDone, updates, fails, hourly, pages>>

\* $pull/index.tsx 'refresh': fetchedAt = new Date(), the same six reads, then
\* store.savePrData, in the request handler.  The process trigger after it is
\* outside this model.  Never touches the watermark.
PageRefresh(p) ==
    /\ WithPageRefresh /\ repoAdded /\ pages < 1
    /\ lease["page"].phase = "none"
    /\ pages' = pages + 1
    /\ Set("page", [NoRun EXCEPT !.kind = "page", !.tgt = p, !.inc = TRUE, !.todo = {p},
                                 !.phase = "pick"])
    /\ UNCHANGED <<now, ghVer, ghUpd, raw, seen, watermark, fclock, listSec, hooks, pend,
                   repoAdded, quiet, finalDone, updates, fails, hourly>>

---------------------------------------------------------------------------
(* One crawl run, crawl.server.ts crawlJob.  The "page" lane reuses the   *)
(* fetch steps PrFetchBegins .. PrSaved and ends with no watermark write. *)

Others == <<now, ghVer, ghUpd, hooks, repoAdded, quiet, updates, hourly, pages>>

\* A durably worker leases the pending run.  Each worker runs one run at a time
\* (maxConcurrentRuns defaults to 1; durably.server.ts does not set it), and
\* durably.init() starts one worker in every process that imports durably.server.ts.
\* getOrganization() runs first and reads organization.repositories and
\* repo.scanWatermark.
CrawlStarts(k) ==
    /\ k \in CrawlKeys
    /\ Run(k).phase = "none" /\ pend[k].kind # "none"
    /\ Cardinality({j \in CrawlKeys : lease[j].phase # "none"}) < Workers
    /\ LET inc == (k = "repo") \/ repoAdded
       IN Set(k, [NoRun EXCEPT !.kind = pend[k].kind, !.tgt = pend[k].tgt,
                     !.inc = inc, !.wm = watermark, !.q = quiet,
                     !.todo = IF pend[k].kind = "target" THEN {pend[k].tgt} ELSE {},
                     !.listed = IF pend[k].kind = "target" /\ ~TargetedNeverAdvances
                                THEN {<<pend[k].tgt, ghUpd[pend[k].tgt]>>} ELSE {},
                     !.phase = IF ~inc THEN "done"
                               ELSE IF pend[k].kind = "sweep" THEN "list" ELSE "pick"])
    /\ pend' = [pend EXCEPT ![k] = NoPend]
    /\ UNCHANGED <<raw, seen, watermark, fclock, listSec, finalDone, fails>> /\ UNCHANGED Others

\* step fetch-prs: fetcher.pullrequestList(stopBefore), UPDATED_AT DESC,
\* paging stops at the first node with updatedAt <= stopBefore.
\* With PartialListing, paginateGraphQL skips null nodes without an error.
Listed(w, p) == w = None \/ (IF StopInclusive THEN ghUpd[p] > w ELSE ghUpd[p] >= w)
PrListFetched(k) ==
    /\ Run(k).phase = "list"
    /\ LET L == {p \in PRs : Listed(Run(k).wm, p)}
       IN \E S \in (IF PartialListing THEN SUBSET L ELSE {L}) :
            Set(k, [Run(k) EXCEPT !.listed = {<<p, ghUpd[p]>> : p \in S},
                                  !.todo = S, !.full = (S = L), !.phase = "pick"])
    /\ listSec' = now
    /\ UNCHANGED <<raw, seen, watermark, fclock, pend, finalDone, fails>> /\ UNCHANGED Others

\* step fetch-pr:<repo>:#<n> begins: fetchedAt = new Date().toISOString()
PrFetchBegins(k) ==
    /\ Run(k).phase = "pick" /\ Run(k).todo # {}
    /\ \E p \in Run(k).todo :
         Set(k, [Run(k) EXCEPT !.cur = p, !.todo = @ \ {p}, !.fa = fclock + 1,
                               !.phase = "read"])
    /\ fclock' = fclock + 1
    /\ UNCHANGED <<raw, seen, watermark, listSec, pend, finalDone, fails>> /\ UNCHANGED Others

\* the Promise.all of pullrequest/commits/comments/reviews/timelineItems/files
PrDetailsRead(k) ==
    /\ Run(k).phase = "read"
    /\ Set(k, [Run(k) EXCEPT !.rv = ghVer[Run(k).cur], !.phase = "save"])
    /\ UNCHANGED <<raw, seen, watermark, fclock, listSec, pend, finalDone, fails>> /\ UNCHANGED Others

\* a read throws: the step returns {saved:false}
PrDetailsFail(k) ==
    /\ Run(k).phase = "read" /\ fails < MaxFails
    /\ fails' = fails + 1
    /\ Set(k, [Run(k) EXCEPT !.phase = "pick"])
    /\ UNCHANGED <<raw, seen, watermark, fclock, listSec, pend, finalDone>> /\ UNCHANGED Others

\* store.savePrData: upsert ... WHERE excluded.fetchedAt >= githubRawData.fetchedAt.
\* The step returns {saved:true} even when the WHERE discards the write.
PrSaved(k) ==
    /\ Run(k).phase = "save"
    /\ LET r == Run(k) IN
       /\ IF ~SaveGuard \/ r.fa >= raw[r.cur].fa
          THEN /\ raw' = [raw EXCEPT ![r.cur] = [ver |-> r.rv, fa |-> r.fa]]
               /\ seen' = [seen EXCEPT ![r.cur] = IF r.rv > @ THEN r.rv ELSE @]
          ELSE UNCHANGED <<raw, seen>>
       /\ Set(k, [r EXCEPT !.saved = @ \cup {r.cur}, !.phase = "pick"])
    /\ UNCHANGED <<watermark, fclock, listSec, pend, finalDone, fails>> /\ UNCHANGED Others

\* computeAdvancedScanWatermark + step advance-scan-watermark (store.setScanWatermark,
\* an unconditional UPDATE).  Targeted fetches have no updatedAt, so never advance.
AllSaved(r) == \A e \in r.listed : e[1] \in r.saved
WatermarkStep(k) ==
    /\ Run(k).phase = "pick" /\ Run(k).todo = {}
    /\ LET r == Run(k) IN
       /\ IF (r.kind = "sweep" \/ (r.kind = "target" /\ ~TargetedNeverAdvances))
             /\ r.listed # {} /\ (AdvanceNeedsAllSaved => AllSaved(r))
          THEN watermark' = Max({e[2] : e \in r.listed})
          ELSE UNCHANGED watermark
       /\ Set(k, [r EXCEPT !.phase = "done"])
    /\ UNCHANGED <<raw, seen, fclock, listSec, pend, finalDone, fails>> /\ UNCHANGED Others

\* the run completes (trigger-process is outside this model) and releases the key
CrawlEnds(k) ==
    /\ Run(k).phase = "done"
    /\ LET r == Run(k) IN
       finalDone' = (finalDone \/ (k = "org" /\ r.kind = "sweep" /\ r.q /\ r.inc
                                    /\ r.full /\ AllSaved(r)))
    /\ Set(k, NoRun)
    /\ UNCHANGED <<raw, seen, watermark, fclock, listSec, pend, fails>> /\ UNCHANGED Others

---------------------------------------------------------------------------

Settled ==
    /\ quiet /\ finalDone /\ repoAdded /\ hooks = {}
    /\ \A k \in Keys : pend[k].kind = "none" /\ lease[k].phase = "none"

\* End state: nothing left to happen.
AllQuiet == Settled /\ UNCHANGED vars

Next ==
    \/ Tick \/ GoQuiet \/ HourlyTrigger \/ RepoAdded
    \/ \E p \in PRs : PrUpdated(p) \/ WebhookHandled(p) \/ PageRefresh(p)
    \/ \E k \in Keys : \/ CrawlStarts(k) \/ PrListFetched(k) \/ PrFetchBegins(k)
                       \/ PrDetailsRead(k) \/ PrDetailsFail(k) \/ PrSaved(k)
                       \/ WatermarkStep(k) \/ CrawlEnds(k)
    \/ AllQuiet

Spec == Init /\ [][Next]_vars

---------------------------------------------------------------------------
(* Rules *)

\* Harm if broken: the dashboard keeps an old version of a PR until someone
\* touches that PR again, because no later sweep lists it.
Converged == Settled => \A p \in PRs : raw[p].ver = ghVer[p]

\* Harm if broken: a newer copy of a PR is replaced by an older one.
RawNeverGoesBack == \A p \in PRs : raw[p].ver >= seen[p]

TypeOK ==
    /\ watermark \in {None} \cup (0..MaxTime)
    /\ \A k \in Keys : lease[k].phase \in {"none", "list", "pick", "read", "save", "done"}
=============================================================================
