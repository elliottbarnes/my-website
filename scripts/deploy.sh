#!/usr/bin/env bash
# Deploy only the verified static artifact. No sync, delete, rebuild, or infrastructure changes.
set -euo pipefail
export AWS_PAGER="" AWS_CLI_AUTO_PROMPT=off

if [[ $# -ne 1 || ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: bash scripts/deploy.sh <40-character lowercase git commit SHA>" >&2
  exit 2
fi

readonly commit_sha="$1"
readonly bucket="elliottbarnes.ca"
readonly distribution="E2SJR1NL1E5LJX"
readonly account="247222972014"
readonly region="ca-central-1"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly repo_root="$(dirname -- "$script_dir")"
readonly artifact_dir="$repo_root/dist"
cd "$repo_root"
source "$script_dir/snapshot-object.sh"

for command in aws node jq git; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 1; }
done
[[ "$(git rev-parse HEAD)" == "$commit_sha" ]] || {
  echo "Refusing deployment: requested commit is not the checked-out HEAD." >&2; exit 1;
}
git diff --quiet "$commit_sha" -- || {
  echo "Refusing deployment: tracked source has changes outside the requested commit." >&2; exit 1;
}

# The verifier checks exact membership, regular files, links and source-byte equality.
verified="$(node scripts/verify-site.mjs "$artifact_dir" --source "$repo_root" --json)"
file_count="$(node --input-type=module -e 'import { PUBLIC_FILES } from "./scripts/public-files.mjs"; console.log(PUBLIC_FILES.length)')"
jq -e --argjson count "$file_count" '.files == $count and (.sha256 | length == $count)' <<<"$verified" >/dev/null
public_files="$(node --input-type=module -e '
  import { PUBLIC_FILES, contentType } from "./scripts/public-files.mjs";
  console.log(JSON.stringify(PUBLIC_FILES.map(path => ({path, content_type: contentType(path)}))));
')"
jq -e --argjson count "$file_count" 'length == $count and ([.[].path] | unique | length == $count)
  and all(.[]; (.path | test("^[a-zA-Z0-9_./-]+$"))
    and (.path | startswith("/") | not)
    and (.path | split("/") | all(. != ".." and . != "." and . != ""))
    and (.content_type | type == "string" and length > 0))' <<<"$public_files" >/dev/null

while IFS= read -r key; do
  git cat-file -e "$commit_sha:$key" || {
    echo "Refusing deployment: public file is not in the requested commit: $key" >&2; exit 1;
  }
  jq -e --arg key "$key" '.sha256[$key] | type == "string" and test("^[0-9a-f]{64}$")' \
    <<<"$verified" >/dev/null
done < <(jq -r '.[].path' <<<"$public_files")

caller="$(aws sts get-caller-identity --output json)"
[[ "$(jq -r '.Account' <<<"$caller")" == "$account" ]] || {
  echo "Refusing deployment: AWS credentials belong to an unexpected account." >&2; exit 1;
}
versioning="$(aws s3api get-bucket-versioning --bucket "$bucket" \
  --expected-bucket-owner "$account" --region "$region" --output json)"
[[ "$(jq -r '.Status' <<<"$versioning")" == "Enabled" ]] || {
  echo "Refusing deployment: S3 versioning is not Enabled." >&2; exit 1;
}

# Records live outside dist, are never included in the public allowlist, and are kept for rollback.
mkdir -p "$repo_root/.deployments"
record_dir="$(mktemp -d "$repo_root/.deployments/run-${commit_sha:0:12}-XXXXXXXX")"
readonly record="$record_dir/deployment-record.json"
stage="snapshotting"
current_key=""
on_exit() {
  exit_code=$?
  if [[ $exit_code -ne 0 && -f "$record" ]]; then
    jq --arg stage "$stage" --arg key "$current_key" --argjson code "$exit_code" \
      '.status = "failed" | .failure = {stage:$stage, key:$key, exit_code:$code}
       | .finished_at = (now | todateiso8601)' "$record" > "$record.tmp" \
      && mv "$record.tmp" "$record"
    echo "Deployment failed during $stage. Recovery record: $record" >&2
  fi
}
trap on_exit EXIT

jq -n --arg commit "$commit_sha" --arg bucket "$bucket" --arg dist "$distribution" \
  --arg account "$account" --arg actor "$(jq -r '.Arn' <<<"$caller")" \
  --arg run_id "${GITHUB_RUN_ID:-local}" --arg run_attempt "${GITHUB_RUN_ATTEMPT:-1}" \
  --arg repository "${GITHUB_REPOSITORY:-local}" --argjson artifact "$verified" \
  '{schema_version:1, status:"snapshotting", started_at:(now|todateiso8601),
    commit:$commit, bucket:$bucket, distribution:$dist, account:$account, caller:$actor,
    run:{id:$run_id, attempt:$run_attempt, repository:$repository},
    artifact:$artifact, objects:[], invalidation:null, live_verification:null}' > "$record"
echo "Deployment record: $record"

while IFS= read -r key; do
  current_key="$key"
  prior="$(snapshot_public_object "$key")" || {
    echo "Cannot safely snapshot $key; no uploads have started." >&2; exit 1;
  }
  content_type="$(jq -r --arg key "$key" '.[] | select(.path == $key) | .content_type' <<<"$public_files")"
  sha256="$(jq -r --arg key "$key" '.sha256[$key]' <<<"$verified")"
  jq --arg key "$key" --arg type "$content_type" --arg sha "$sha256" --argjson prior "$prior" \
    '.objects += [{key:$key, content_type:$type, sha256:$sha, prior:$prior, uploaded:null}]' \
    "$record" > "$record.tmp"
  mv "$record.tmp" "$record"
done < <(jq -r '.[].path' <<<"$public_files")

# Check again after the read-only snapshot, before the first write.
node scripts/verify-site.mjs "$artifact_dir" --source "$repo_root" --json > "$record_dir/rechecked.json"
jq -e --slurpfile before "$record" '.sha256 == $before[0].artifact.sha256' \
  "$record_dir/rechecked.json" >/dev/null
stage="uploading"
jq '.status = "uploading"' "$record" > "$record.tmp"
mv "$record.tmp" "$record"

# HTML and fixed-name code must revalidate; versioned URLs bypass older browser entries.
# Other assets get short cache lifetimes. HTML entrypoints are uploaded last.
while IFS= read -r key; do
  current_key="$key"
  content_type="$(jq -r --arg key "$key" '.objects[] | select(.key==$key) | .content_type' "$record")"
  sha256="$(jq -r --arg key "$key" '.objects[] | select(.key==$key) | .sha256' "$record")"
  checksum="$(node -e 'process.stdout.write(Buffer.from(process.argv[1],"hex").toString("base64"))' "$sha256")"
  cache_control="public,max-age=300,must-revalidate"
  if [[ "$key" == "index.html" || "$key" == "404.html" || "$key" == *.css || "$key" == *.js ]]; then
    cache_control="no-cache,max-age=0,must-revalidate"
  fi
  echo "Uploading $key"
  create_only=()
  if jq -e --arg key "$key" '.objects[] | select(.key==$key) | .prior.exists == false' "$record" >/dev/null; then
    create_only=(--if-none-match '*')
  fi
  aws s3api put-object --bucket "$bucket" --key "$key" --body "$artifact_dir/$key" \
    "${create_only[@]}" \
    --expected-bucket-owner "$account" --region "$region" --content-type "$content_type" \
    --cache-control "$cache_control" --metadata "git-sha=$commit_sha" \
    --checksum-algorithm SHA256 --checksum-sha256 "$checksum" --output json \
    > "$record_dir/put.json"
  jq --arg key "$key" --arg cache "$cache_control" --slurpfile uploaded "$record_dir/put.json" \
    '(.objects[] | select(.key==$key)) |=
      (.uploaded = {version_id:$uploaded[0].VersionId, etag:$uploaded[0].ETag,
        checksum_sha256:$uploaded[0].ChecksumSHA256, cache_control:$cache, at:(now|todateiso8601)})' \
    "$record" > "$record.tmp"
  mv "$record.tmp" "$record"
  jq -e '.VersionId | type == "string" and length > 0 and . != "null"' \
    "$record_dir/put.json" >/dev/null
done < <(jq -r '.[] | select(.path != "404.html" and .path != "index.html") | .path' <<<"$public_files"
  printf '%s\n' '404.html' 'index.html')

stage="invalidating"
current_key=""
aws cloudfront create-invalidation --distribution-id "$distribution" --paths '/*' \
  --region us-east-1 --output json > "$record_dir/invalidation.json"
invalidation_id="$(jq -er '.Invalidation.Id | select(type == "string" and length > 0)' "$record_dir/invalidation.json")"
jq --arg id "$invalidation_id" '.status="invalidating" | .invalidation={id:$id,status:"InProgress"}' \
  "$record" > "$record.tmp"
mv "$record.tmp" "$record"
aws cloudfront wait invalidation-completed --distribution-id "$distribution" \
  --id "$invalidation_id" --region us-east-1
jq '.invalidation.status="Completed" | .status="verifying"' "$record" > "$record.tmp"
mv "$record.tmp" "$record"

stage="verifying"
node scripts/verify-live.mjs "$artifact_dir" --json > "$record_dir/live.json"
jq -e --slurpfile original "$record" \
  '.files == $original[0].artifact.files and .sha256 == $original[0].artifact.sha256' "$record_dir/live.json" >/dev/null
jq --slurpfile live "$record_dir/live.json" \
  '.status="verified" | .live_verification=$live[0] | .finished_at=(now|todateiso8601)' \
  "$record" > "$record.tmp"
mv "$record.tmp" "$record"
echo "Verified https://elliottbarnes.ca/ against all $file_count deployed files."
echo "Retain this nonpublic deployment record for rollback: $record"
