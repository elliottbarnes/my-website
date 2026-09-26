#!/usr/bin/env bash
# Sourced by deploy.sh. All callers pass keys from the verified publication allowlist.
# Never treat a denied/malformed lookup as proof that an object is new.
snapshot_public_object() {
  local key="$1" head listing
  if head="$(aws s3api head-object --bucket "$bucket" --key "$key" \
      --expected-bucket-owner "$account" --region "$region" --output json)"; then
    jq -e '.VersionId | type == "string" and length > 0 and . != "null"' <<<"$head" >/dev/null || return 1
    jq '{exists:true, version_id:.VersionId, etag:.ETag, last_modified:.LastModified}' <<<"$head"
    return
  fi
  [[ "$key" == assets/* ]] || { echo "Cannot snapshot existing entrypoint: $key" >&2; return 1; }
  listing="$(aws s3api list-objects-v2 --bucket "$bucket" --prefix "$key" \
    --max-keys 1 --no-paginate --no-fetch-owner --expected-bucket-owner "$account" \
    --region "$region" --output json)" || return 1
  # In this general-purpose bucket, an exact key sorts before longer prefix matches.
  jq -e --arg key "$key" --arg bucket "$bucket" '
    .Name == $bucket and .Prefix == $key and .MaxKeys == 1
    and (.IsTruncated | type == "boolean")
    and (.KeyCount == 0 or .KeyCount == 1)
    and ((.Contents // []) | type == "array")
    and ((.Contents // []) | length) == .KeyCount
    and (if .KeyCount == 0 then .IsTruncated == false
         else (.Contents[0].Key | type == "string") and
           (.Contents[0].Key | startswith($key)) and .Contents[0].Key != $key end)
  ' <<<"$listing" >/dev/null || { echo "Cannot prove asset is absent: $key" >&2; return 1; }
  printf '%s\n' '{"exists":false,"version_id":null}'
}
