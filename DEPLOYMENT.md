# Deployment

The portfolio is a dependency-free static site at https://elliottbarnes.ca, served through CloudFront from a private, versioned S3 bucket. No application server runs for the portfolio or its games.

## Build and preview

Use Node.js 24:

```bash
node --test
node build.mjs
node scripts/verify-site.mjs dist --source .
node server.mjs --dir dist
```

`scripts/public-files.mjs` is the source publication allowlist. Build reads only those public files, generates project markup from `data/projects.mjs`, and rejects public-file symlinks. It writes:

- `dist/`: the exact public artifact.
- `dist.manifest.json`: a private mapping from source filenames to published paths and SHA-256 hashes. This sits outside the website and is not uploaded to S3.

`index.html`, `404.html`, `robots.txt`, `sitemap.xml`, and `site.webmanifest` keep their root URLs. CSS, JavaScript, fonts, images, and asset notices receive content-hashed names under `assets/`. Source files retain readable fixed names. A hash is calculated from the final published bytes, after rewriting dependencies, so changing a game updates its loader's filename and the HTML reference automatically. There is no manual `?v=` update step.

Resource paths in HTML, CSS, and JavaScript use complete, root-relative literal URLs (or explicit `./` and `../` paths). Optional loaders list each script/style URL explicitly. Use explicit arrays for numbered images rather than constructing URLs with string interpolation. The build rejects dynamic asset templates and dependency cycles. It preserves external URLs and descriptive strings.

The verifier checks exact file membership, hashes, source-derived output, metadata, local links, project destinations, deferred eager scripts, and references to code loaded on demand. Rebuilding removes only obsolete local output paths from the validated preceding artifact; unexpected files stop the build before changes. The preview serves only source allowlisted files or the current built manifest, with a genuine custom 404. It refreshes the manifest after rebuilds.

## GitHub Actions and AWS boundary

`.github/workflows/site.yml` runs read-only checks on pull requests. Successful `main` pushes build once and transfer `dist/` plus its private manifest to production as the same Actions artifact. The production job verifies both against the checked-out source; it does not rebuild or silently substitute a different release.

The production environment permits `main`. Deployments are serialized without interrupting active uploads, and superseded commits are refused. Actions are pinned to full commit SHAs. Only the production job can exchange a GitHub OIDC token for temporary credentials; no permanent AWS keys are stored in GitHub.

The existing role policies remain in [deploy-trust.json](.github/aws/deploy-trust.json) and [deploy-policy.json](.github/aws/deploy-policy.json). They restrict deployment to this repository/environment, the existing seven root keys, the website's `assets/` prefix, and its CloudFront distribution. Hashed assets fit inside the existing prefix; this change needs no IAM expansion. The role has no delete, IAM administration, bucket-policy, or unrelated-bucket permissions.

## Publication and caching

The deployment script verifies the requested Git commit, committed build inputs, AWS account, bucket ownership, and versioning before uploading. It snapshots every object first. A failed HEAD is never treated as proof of absence: an exact-key prefix listing must establish that a new asset does not exist. Missing root objects, denied listings, malformed responses, or unverifiable existing immutable assets abort before any upload.

Hashed assets receive `Cache-Control: public,max-age=31536000,immutable`. The five root documents receive `no-cache,max-age=0,must-revalidate`. Existing content is reused only when S3's SHA-256 checksum, MIME type, and cache metadata all match. A reused object's version is preserved in the recovery record. Changed files are uploaded using the previous ETag as an `If-Match` precondition; new files require `If-None-Match: *`. A concurrent writer makes the operation fail rather than silently overwrite a changed object. An existing hashed URL with different or missing checksum evidence is never overwritten.

Assets upload first, then `404.html`, then `index.html`. Old immutable assets remain available, so old pages and in-flight visitors retain the files they reference. New paths need no invalidation. Changed existing paths are invalidated, including `/` when `index.html` changes. An entirely unchanged deployment performs no uploads or invalidation. This preserves the current CloudFront configuration and compression settings.

After publication, `scripts/verify-live.mjs dist` checks every exact published URL, including games and styles loaded on demand, for matching bytes, MIME type, and cache headers. It also checks the apex homepage, HTTP/www redirects, and a custom 404 response. Requests are bounded and transient failures get at most three attempts.

This sequence avoids mixing old HTML with new fixed-name code; it is not a transaction spanning all root documents. A failed run still requires an operator to inspect its record. Source tests and local previews do not establish production success.

## Recovery

Every deployment writes `.deployments/run-.../deployment-record.json`, outside the public artifact. It records the source commit, all public hashes and paths, previous versions, reused objects, uploaded versions, invalidation, verification, and any failure stage. Actions retains the record for 90 days, including partial failures. Save important records before retention expires.

Prefer redeploying a reviewed source revision on `main`. For an explicitly authorized manual rollback, select a verified earlier deployment record, ensure its referenced immutable assets still exist, and restore that record's root-document S3 versions using `copy-object`. Restore `404.html` before `index.html`, invalidate changed root paths, and verify against the earlier artifact. Preserve exact recorded keys and versions. Do not delete assets or versions. New paths without a previous version are simply left unused by the restored HTML.

No automatic rollback, remote deletion, or lifecycle/retention change is performed. Old fixed-name assets from releases before hashed publishing also remain until separately authorized cleanup. S3 storage growth can be measured before proposing a retention policy.

Official references: [CloudFront file versioning](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/UpdatingExistingObjects.html), [S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html), [GitHub OIDC on AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws).
