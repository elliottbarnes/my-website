# Deployment

The portfolio is a dependency-free static site hosted at https://elliottbarnes.ca through CloudFront and a private, versioned S3 bucket.

## Check and preview

Use Node.js 24:

```bash
node --test
node build.mjs
node scripts/verify-site.mjs dist --source .
node server.mjs --dir dist
```

The build and verifier share the exact 21-file allowlist in `scripts/public-files.mjs`. Extra files, missing files, symlinks, broken local references, invalid metadata, and source/build differences fail validation. The preview serves only public files, including a real custom 404 response.

## GitHub Actions

`.github/workflows/site.yml` runs read-only checks for pull requests. Successful pushes to `main` build an artifact once, then deploy that same artifact. A manual run is also available on `main`.

The production job:

1. Uses the `production` environment, configured to permit only the `main` branch.
2. Serializes production deployments without interrupting an upload in progress.
3. Refuses a commit that has already been superseded on `main`.
4. Exchanges a GitHub OIDC token for temporary AWS role credentials. No AWS keys are stored in GitHub.
5. Checks artifact hashes against the checked-out source and verifies bucket ownership/versioning.
6. Records all existing object versions before uploading anything.
7. Uploads non-HTML files first, then `404.html`, then `index.html`. It never deletes objects.
8. Invalidates the website distribution and verifies all 21 HTTPS file hashes, the versioned CSS/JavaScript URLs, the apex homepage, HTTP/www redirects, and the custom 404.

All Actions are pinned to full commit SHAs. The check job has only `contents: read`; only the production job can request an OIDC token.

## AWS publication boundary

The role `ElliottWebsiteGitHubDeploy` uses the complete reviewed policies in:

- [deploy-trust.json](.github/aws/deploy-trust.json): exact repository/environment subject, AWS STS audience, main ref, and immutable repository/owner IDs.
- [deploy-policy.json](.github/aws/deploy-policy.json): inspect bucket versioning, read/write/recover only the 21 named public objects, and invalidate/read invalidations for the one website distribution.

There are no delete, IAM administration, role-passing, bucket-policy, or unrelated-bucket permissions. GitHub's environment branch restriction also prevents untrusted PR deployments. AWS policy validation and allowed/denied object simulations are part of setup verification.

The role intentionally cannot list the bucket. All 21 keys must already exist with version IDs. A missing or new key requires an administrator to review the allowlist/policy change and bootstrap a versioned object; any failed prior-version lookup aborts before uploads.

Sources: [GitHub OIDC on AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws), [AWS GitHub OIDC condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html), [S3 HeadObject permission behavior](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html).

## Caching and verification

HTML, CSS, and JavaScript ask caches to revalidate; other assets use a five-minute cache lifetime. The HTML references CSS and JavaScript with a `?v=` query containing the first 12 characters of that file's SHA-256 hash. A new URL prevents a browser from reusing the old release's locally cached stylesheet or script. The verifier rejects missing or stale versions, and live checks request the exact versioned URLs as well as the fixed filenames.

After editing `styles.css` or `script.js`, update its version in `index.html` before verifying:

```bash
shasum -a 256 styles.css script.js
```

This preserves the 21-object publication boundary. Query versions distinguish browser cache entries; they do not create immutable S3 objects or guarantee separate CloudFront cache entries. The CloudFront policy may impose its minimum TTL, so the workflow still invalidates the entire small site and waits for completion. HTTPS verification checks actual bytes, not only status codes. CloudFront invalidation alone does not clear copies already cached on visitors' devices. See [AWS's explanation of invalidation and browser caches](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html).

This is not an atomic release: requests during an upload can briefly mix old HTML with new fixed-name assets. Keep file changes backward-compatible. Avoid manual uploads while an Actions deployment is running.

```bash
node scripts/verify-live.mjs dist
```

## Recovery records and rollback

Each deployment writes `.deployments/run-.../deployment-record.json`, outside the public artifact. It records the source commit, hashes, previous/new S3 version IDs, run identity, invalidation, and final verification. GitHub retains the record artifact for 90 days, including partial failures. Download important records before that retention expires. The workflow does not delete S3 objects or versions.

For an actual rollback, choose a verified earlier commit and its deployment record. Prefer redeploying a reviewed source change on `main`; otherwise an authorized operator can restore each record's `prior.version_id` as a new current version with `aws s3api copy-object`. Use the exact recorded key/version; do not delete current versions or add delete markers. Restore non-HTML files first, then 404 and index last, invalidate CloudFront, and verify against the chosen earlier artifact.

Example for one reviewed object (substitute a real recorded version; this is not a complete rollback):

```bash
aws s3api copy-object \
  --bucket elliottbarnes.ca --key index.html \
  --copy-source 'elliottbarnes.ca/index.html?versionId=RECORDED_VERSION_ID' \
  --expected-bucket-owner 247222972014 \
  --region ca-central-1
```

A failed deployment record indicates which objects were uploaded. Resolve the failure or restore the complete consistent prior set before treating the release as recovered. No automatic rollback or deletion is performed.
