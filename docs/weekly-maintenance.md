# Weekly maintenance

The checks workflow runs every Monday at **01:37 UTC (09:37 Asia/Manila)** and can be started manually from **Actions → Weekly checks → Run workflow**. The [backup workflow](weekly-backup.md) has its own setup and runs at 01:17 UTC (09:17 Asia/Manila). The schedules are separate; checks do not wait for backups.

## Checks

[Weekly checks](../.github/workflows/weekly-checks.yml) starts three independent jobs. A failure in one does not skip the others:

- **Tests and production dependency audit** calls the existing [CI workflow](../.github/workflows/ci.yml) at the same commit. It retains its production dependency audit, lint, unit tests, local database tests and lint, integration tests, typecheck, production build, and browser tests. CI still runs on pushes and pull requests, and now also supports manual runs and reuse. Its existing 30-minute timeout, cleanup, and seven-day browser evidence retention remain in place.
- **Audit all dependencies** runs `npm audit --package-lock-only --include=dev --audit-level=high` independently of the tests. It audits the committed lockfile, including development dependencies, without installing packages or running package scripts. High or critical advisories cause failure; lower severity findings remain visible in the audit output. It does not apply fixes. Registry or network errors also fail the job and require inspection of its logs.
- **Open issue inventory** reads every page of open repository issues, excluding pull requests. It produces counts of open, stale, unassigned, and unlabeled issues; age buckets; and a table with issue links, titles, age, days since update, stale status, labels, and all assignees. Both standalone jobs have ten-minute timeouts.

## Issue inventory and human review

Read the inventory in the workflow run summary or download **open-issue-inventory**, which contains `open-issues.md` and requests **90-day retention**. Very large tables are available in full in the artifact; the summary retains the counts and directs readers to that artifact. Browser evidence keeps its existing seven-day retention.

An issue is marked stale after at least 30 complete 24-hour days without an update. Entries are ordered by oldest update, then issue number. Age is measured from creation. Stale, unassigned, and unlabeled entries are triage hints, not judgments about priority or validity. A maintainer should follow the links, read the discussion, and decide whether follow-up, assignment, labeling, or closure is appropriate. This generated inventory does **not** perform a semantic review, identify duplicates, or determine whether work is complete.

The report never creates, comments on, labels, assigns, or closes issues. Its token has only `issues: read`; it does not check out repository code or use custom secrets. Titles, labels, and assignees are treated as untrusted text: control characters are replaced with spaces and Markdown/HTML punctuation is encoded. Links are constructed from repository context and issue numbers, not issue text. Issue bodies and comments are omitted from the output. The REST listing is a live view, so concurrent issue updates can affect pagination results.

## GitHub setup and operation

1. Configure the GitHub remote, create the initial commit, and push the repository and both checks workflow files to the default branch. This checkout currently has no commits or remote; these local files do not activate automation. Scheduled runs use the latest default-branch commit, and the manual-run button requires the workflow to exist on the default branch.
2. Ensure GitHub Actions is enabled and repository/organization policies allow `actions/checkout@v4`, `actions/setup-node@v4`, `actions/github-script@v8`, and `actions/upload-artifact@v4` on GitHub-hosted Ubuntu runners. The workflows follow the existing major-version action convention. Node is selected from `.nvmrc`; dependency auditing needs registry access, and CI needs Docker for local Supabase and network access for dependencies and browser installation.
3. Keep GitHub Issues enabled. The built-in `GITHUB_TOKEN` is sufficient: checks use `contents: read`, while the inventory uses `issues: read`. The weekly workflow grants no permissions by default and passes no custom secrets to CI. Uploading artifacts uses the Actions artifact service; no repository write permission is requested.
4. Ensure the repository/organization artifact policy permits the requested 90-day inventory retention. Follow the separate [encrypted backup setup](weekly-backup.md) for backup secrets and retention requirements.
5. After pushing, manually run **Weekly checks** on the default branch. Inspect all three job results, the issue inventory summary and artifact, the dependency audit logs, and browser evidence. Missing or failed inventory generation is a job failure, not an empty-issues report. Successful inventory generation does not imply CI or the dependency audit passed.

Schedules are best effort: GitHub can delay or drop scheduled runs during load. Public repositories automatically disable scheduled workflows after 60 days without activity; re-enable them in Actions when necessary. Review failed runs and rerun after addressing the reported cause. This workflow does not deploy or update dependencies automatically.

## References

- [Reusable workflows and same-commit local calls](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)
- [Scheduled and manual workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [GitHub Issues REST API, permissions, and pagination](https://docs.github.com/en/rest/issues/issues#list-repository-issues)
- [GitHub Script API and safe input handling](https://github.com/actions/github-script/tree/v8)
- [Artifact retention](https://github.com/actions/upload-artifact/tree/v4#retention-period)
- [npm 11 audit options and failure thresholds](https://docs.npmjs.com/cli/v11/commands/npm-audit/)
