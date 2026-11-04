# Website operations

These tools prepare evidence and reviewable plans. They do not change AWS, deploy,
delete objects, log in, request broader access, or query paid Cost Explorer APIs.
Keep their output outside `dist/`; none is part of the publication allowlist.

## Read-only drift check

```sh
node scripts/audit-infra.mjs codex-routine-read
```

Select an existing read-only profile explicitly. Each AWS subprocess has a 25-second
deadline, one SDK attempt, and no shell interpolation. Calls run four at a time.
An inaccessible check reports `unknown`, never `pass` or proof of absence, and the
command exits nonzero for unknowns or drift. Review its JSON before acting.

The bounded check compares the live deploy role with `.github/aws/deploy-trust.json`
and `deploy-policy.json`, detects added role policies, checks the content bucket's
public-access blocks, versioning, encryption and ownership, and checks both known
distributions' HTTPS redirect, compression and TLS settings. It reports matching
site alarms in us-east-1/ca-central-1 and existing budget configuration without
subscriber addresses. It is not a full account inventory, effective-permissions
analysis or infrastructure-as-code replacement.

On **4 November 2026 at 13:09 UTC**, all nine checks passed. No matching site alarms
were returned in the two regions. The account-wide monthly USD 5 budget was healthy.
That does not establish actual website spending or notification delivery.

The earlier review also verified DNS aliases, private content-origin configuration,
and S3 access-log configuration. Detailed CloudFront policy, OAC signing and ACM
certificate reads were denied to this profile. Preserve those unknowns; do not
switch to administrator access. No complete import or CloudFront update payload
can be safely prepared until the existing configuration and ETags are available.

## Proposed security headers

After the final build and artifact verification:

```sh
node scripts/plan-security-headers.mjs dist
```

This emits proposed HTTP headers plus the exact SHA-256 hashes of both HTML files.
It hashes inline JSON-LD from the final artifact, refuses unexpected executable
inline JavaScript, and supplies both enforcement and report-only CSP forms for
browser testing. It does **not** emit an executable AWS update. Regenerate it after
any HTML change. The browser suite should use this same generated candidate.

The candidate permits same-origin scripts, styles, fonts and images, data images,
and existing dynamic inline styling. It denies network API connections, objects,
embedded frames, base-URL replacement and form submission. Inline styling remains
an explicit limitation; removing it would require reviewing dynamic visual/game
styles. Camera, microphone, geolocation and payment access are disabled. Existing
MIME-sniffing protection, frame denial and a conservative referrer policy are retained.

Approval-ready intent, pending access to the current policy and feature validation:

1. Read and retain the actual response-headers policy JSON, ETag, and distribution
   associations. Prepare the smallest diff; preserve unrelated headers and settings.
2. Test the generated **enforced** CSP against the final artifact in a browser:
   entrance, themes, commands, all optional games/effects, contact links, reduced
   motion, errors and the custom 404. Check console and CSP violation events.
   Source tests alone cannot clear this gate.
3. If HTML and headers change together, permit the union of the **current and new**
   inline-script hashes during rollout. A content deployment cannot automatically
   update headers using the existing narrow deployment role. Keep that role narrow.
4. For an approved observation stage, use report-only CSP and HSTS `max-age=86400`.
   No report endpoint is configured: report-only provides no automatic aggregate
   monitoring; inspection must be deliberate. The proposed Permissions-Policy can
   be reviewed alongside these changes.
5. After compatibility and production checks, separately approve enforced CSP.
   After confirming dependable HTTPS and certificate renewal, consider HSTS
   `max-age=31536000`. Do not add `includeSubDomains` or `preload` by default.

Rollback: retain and reapply the prior header policy using a fresh ETag after
approval, and verify response headers. A browser that cached HSTS keeps it until
expiry; reducing the server value cannot instantly reverse existing client state.
Retain release CSP hashes while an earlier HTML release remains a rollback target.

No new AWS service or permission is needed for this proposal. Normal API/traffic
usage still applies. A production change has not been authorized or applied here.

## Recovery dry run

Retain the **matching artifact and deployment record** for any release selected as
a recovery point. Actions currently retains build artifacts for 14 days and
deployment records for 90 days; a record alone is not the complete dry-run input.
Save a selected recovery pair privately before artifact expiration rather than
increasing retention or deleting S3 versions without review.

```sh
node scripts/plan-recovery.mjs /path/to/deployment-record.json /path/to/retained/dist
```

The planner supports successful schema-1 records from the content-hashed deployment
pipeline. It verifies target identities, successful live verification, exact recorded
hash membership, local file bytes, selected version checksums, and absence of
symlinks/traversal. It chooses uploaded versions for changed files and the prior
version for files reused by that selected successful release. It rejects partial
failed records rather than guessing a recovery state.

Output includes the root versions in restore order (`404.html` before `index.html`),
immutable assets that must remain available, invalidation paths, and outstanding
checks. It performs no AWS call and produces no executable restore command.
Passing a local dry run does not establish that the remote versions still exist.

Before a separately approved production restore:

- Check each selected root version with read-only S3 `head-object --version-id` and
  compare its SHA-256 checksum, content type and cache metadata with the record.
- Check the **current** immutable asset keys referenced by that release. Restoring
  HTML must not expose missing or different assets even if an old version exists.
- Ensure the active CSP permits the selected HTML's inline JSON-LD hashes.
- Capture current root versions/ETags as the new rollback point. Stop on concurrent
  changes; do not blindly overwrite a release deployed during the checks.
- Restore the reviewed root versions in the planned order, invalidate only needed
  root paths, then run `scripts/verify-live.mjs` against the retained artifact and
  check the live browser. Leave immutable assets and object versions intact.

No real production rollback drill was performed. The planner's failure behavior is
tested locally using synthetic records, including changed bytes, missing versions,
failed deployments, wrong targets, conflicting hashes, symlinks and traversal.

## Monitoring, retention and simplification

Use existing GitHub Actions deployment checks, records and failure notifications
first. Confirm the owner's GitHub Actions notification settings and delivery; a
successful workflow is not notification-delivery evidence. A periodic public HTTPS
smoke check can be added using the existing verification code after reviewing its
schedule, artifact comparison source, expected Actions-minute use and notification
route. No scheduled workflow or paid AWS alarm/service is enabled by these tools.

The existing budget has actual-spend notifications at 80%/100% and forecast at 100%.
Recipient delivery remains unverified. AWS budgets are alerts, not spending caps.
Do not treat the USD 5 threshold as the site's measured bill.

No lifecycle rules were found on the content, redirect or log buckets. Version
enumeration was denied; storage growth and savings are unknown. Measure retained
bytes and recovery requirements before suggesting expirations. Logs require a
privacy/retention decision and confirmation that configured logging is receiving
objects. Do not add more logs or a paid monitoring service just to fill a checklist.

The www distribution currently fronts an S3 website redirect origin. An edge
redirect could remove that origin dependency, but two distributions and working
canonical redirects already exist. Defer migration until the current function/
behavior configuration is fully readable and measurable benefits justify the
migration. No redirect-function deployment, resource deletion or full IaC import is
proposed as necessary for this optimization.

## Disposition

| Finding | Disposition |
| --- | --- |
| Reproducible bounded infrastructure checks | Implemented locally; fresh checks passed |
| Deployment role and private versioned content origin | Already adequate in the inspected scope; preserved |
| CSP/HSTS/Permissions-Policy | Candidate generator implemented; browser and production approval gates remain |
| Recovery evidence and safe rehearsal | Local validator/runbook implemented; remote recovery availability unverified |
| Monitoring and budget delivery | Existing checks/budget retained; notification delivery and any recurring schedule require review |
| Storage/log retention savings | Deferred until attributable size/cost and recovery evidence exist |
| Complete IaC import or www migration | Deferred; insufficient benefit/configuration evidence for a safe change |

References: [CloudFront response-headers policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/adding-response-headers.html),
[CloudFront versioned files](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/UpdatingExistingObjects.html),
[GitHub Actions notifications](https://docs.github.com/en/account-and-profile/managing-subscriptions-and-notifications-on-github/setting-up-notifications/configuring-notifications).
