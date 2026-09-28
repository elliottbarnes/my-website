# Optional AWS design for the local Live Demo Lab

**This is a local side project, excluded from the production website. No deployment, model subscription, paid invocation or website connection is authorized.** The packaging script writes a local file and makes no AWS calls. The local server blocks outgoing connections with its Content Security Policy, and the page has no API endpoint configured.

The commands below are a future operator reference. Do not run AWS setup or deployment commands until the owner separately approves the resources, access controls and spending allowance. A disabled deployed API can still incur request, logging and storage charges; keeping this project local is the only no-new-AWS-charges mode documented here.

## Design and cost

Keep Batchline, EvalDeck and Reconcile Kit in the browser. Visitors can enter their own queue pattern, text comparisons and CSV records without a paid service. Prism image generation is the only experiment that needs model inference.

The prepared backend uses an HTTP API, two small on-demand Lambda functions, one on-demand DynamoDB table, a private S3 bucket and Bedrock Stable Image Core in Oregon (`us-west-2`). There are no idle GPU instances, provisioned model capacity, load balancers, VPC/NAT gateways or long-running containers.

1. The API validates a prompt, a nonzero seed and a random request ID.
2. One DynamoDB transaction reserves the job and the global monthly, global daily and source-IP daily attempt allowances. It must succeed before dispatch.
3. An asynchronous Lambda worker conditionally claims the job. Duplicate deliveries cannot claim it again. Bedrock invocations and uncertain dispatches are not automatically retried.
4. The worker checks the provider response and writes a PNG to private `generated/` storage. The client polls job status and receives a short-lived signed image URL.

At the last direct pricing check (2026-09-26), [AWS listed Stable Image Core at US$0.04 per generated image](https://aws.amazon.com/bedrock/pricing/). The page's [public pricing data](https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/bedrockfoundationmodels/USD/current/bedrockfoundationmodels.json), published 2026-09-25, resolves the Core rate to `0.0400000000`. Confirm current pricing and availability before any future deployment. The model ID is fixed to `stability.stable-image-core-v1:1`; [Oregon is its supported region](https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html).

The default allowances are **75 admitted attempts per UTC month, five per UTC day globally, and three per source IP per UTC day**. At the verified rate, 75 single-image attempts correspond to at most **US$3 in model inference charges**. Failed, filtered and uncertain attempts still consume allowance; an interrupted result is not a reason to refund a possibly billed invocation. Replaying the same request ID and same inputs returns the existing job without reserving another attempt. Reusing the ID with different inputs fails. A new request ID is a new attempt, even if its prompt and seed match another job; there is no shared prompt cache.

**This is not a cap on the AWS bill.** API requests, Lambda runtime, DynamoDB, S3 storage and delivery, and logs are additional. Traffic throttles are best effort, IP limits can be bypassed with multiple addresses, and attackers could consume the small shared image allowance. The existing account US$5 AWS Budget alerts are notifications, not an immediate spending stop. Keep the local project disconnected while evaluating private or invite-only access.

## Defaults and boundaries

| Boundary | Prepared setting |
|---|---|
| Public access | `PublicDemoAccess=false`: every route requires AWS IAM signed requests |
| Paid image generation | `GenerationEnabled=false` in both functions |
| Browser origin | One HTTPS `AllowedOrigin`; CORS is not authentication |
| Model | Only Stable Image Core `v1:1` in Oregon; the template's region map rejects other regions |
| Prompt and seed | 3–1,000 prompt characters; integer seed 1–4,294,967,295; JSON body limited to 4,096 bytes |
| API Lambda | Python 3.13, ARM64, 256 MB, 15 seconds, reserved concurrency two |
| Worker Lambda | Python 3.13, ARM64, 512 MB, 120 seconds, reserved concurrency two |
| Worker queue | Maximum event age 300 seconds; zero function-error retries; application claim remains idempotent |
| API throttles | Stage one request/second with burst three; POST generation 0.1 requests/second with burst one |
| DynamoDB | On demand; maximum 20 read and 20 write request units/second; TTL on `expiresAt` |
| Image storage | S3 Block Public Access, owner-enforced ownership, SSE-S3 encryption, HTTPS only |
| Logs | Three-day retention; generic error codes, no request bodies, prompts or raw source IPs |

The unsigned browser client deliberately cannot access the AWS IAM defaults. No AWS credentials belong in the browser or repository. A future authenticated frontend requires a separate access design; switching `PublicDemoAccess=true` would expose the routes and needs explicit approval. Enabling that switch and enabling paid generation are independent decisions. Connecting a client also requires deliberate changes to its empty endpoint setting and restrictive CSP, outside this local preparation.

The four-item admission transaction consumes at least eight write request units; longer or multibyte prompts require more because DynamoDB rounds each item by size. The 20-unit write ceiling leaves room for those validated inputs and worker updates. These are throughput ceilings, not monthly cost caps, and the service fails closed when capacity is unavailable.

The API's role can read job records, atomically reserve attempts, invoke its worker and sign reads from this bucket's `generated/` prefix. The worker can update this table, write only that prefix and invoke only the fixed Bedrock model. Both roles can write only their own log streams. No broad AWS-managed runtime policies or static AWS credentials are used. [DynamoDB transaction permissions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis-iam.html) use `PutItem` and `UpdateItem` with the enclosing transaction condition, rather than a nonexistent `dynamodb:TransactWriteItems` IAM action.

Prompts and seeds are stored in DynamoDB for job handling and sent to the chosen Bedrock model. Raw source IPs are converted to daily HMAC values before persistence. The required `IPHashSecret` parameter has `NoEcho`, no default, and at least 32 random characters; it is stored in encrypted Lambda environment configuration and remains visible to sufficiently privileged account operators. Do not enable Bedrock invocation logging without revisiting privacy because it can retain prompts and outputs. Do not introduce third-party model providers or additional output storage by default.

The application stops serving a job 24 hours after creation. Signed image links last at most five minutes and never extend past that application expiry. DynamoDB TTL and S3's one-day lifecycle deletion run asynchronously; they are not promises of physical deletion exactly at 24 hours. Images are deliberately unversioned so expired output has no retained historical versions. The bucket and table have `Retain` deletion policies: stack deletion alone does not remove them. They need a separately reviewed cleanup after their data expires.

There is intentionally no failed-event destination or automatic redrive queue. A missing/expired worker delivery becomes a timed-out job in the API after ten minutes; resubmitting is an explicit new attempt. This keeps discarded request details out of another storage service and prevents unattended paid retries.

## Local verification (no AWS account needed)

From the `side-projects/live-demo-lab` directory:

```bash
node --test tests/*.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_live_backend.py'
node scripts/package-live-demos.mjs
```

Packaging creates ignored `.aws-live/template.json`. It embeds the exact reviewed Python source twice through a standard-library zlib/base64 bootstrap, adds a SHA-256 source digest, and rejects a generated template larger than CloudFormation's 51,200-byte `TemplateBody` limit. Tests decompress both functions, check byte-for-byte source equality, import the packaged handlers without boto3 or credentials, exercise the disabled health response, and verify infrastructure access, capacity and retention boundaries.

Review readable source in `backend/live_demos/app.py` and `infra/live-demos.template.json`; the source template's inline code intentionally fails until packaged. Packaging is reproducible and does not upload code, create infrastructure or change CI.

`cfn-lint` and `cfn-guard` were not installed in the preparation environment. Local tests are not a substitute for CloudFormation schema, account permissions, service quota, model access or deployment validation. When separately approved, install these tools in an isolated tooling environment, run `cfn-lint --regions us-west-2 --template .aws-live/template.json`, and run `cfn-guard` with a reviewed rules file. Guard has no built-in default rules. Deliberate exceptions to common rules are ephemeral unversioned images, default AWS-owned-key DynamoDB encryption, and no worker redrive destination, as described above.

## Future staged deployment reference — not authorized to run now

1. **Approve the design first.** Agree an access method, expected traffic and a spending allowance. Keep this side project separate from the public website. Recheck current pricing, model lifecycle and whether private testing justifies any AWS costs.
2. **Use a named temporary administrative profile.** Arrange temporary credentials under `live-demo-admin` through the owner's existing AWS sign-in flow. Never use or replace the default profile, create permanent access keys, or add infrastructure permissions to the website's GitHub deploy role. Verify the intended account and region before any changes:

   ```bash
   aws sts get-caller-identity --profile live-demo-admin --region us-west-2
   aws bedrock get-foundation-model --model-identifier stability.stable-image-core-v1:1 --profile live-demo-admin --region us-west-2
   ```

   Confirm model lifecycle is active, on-demand invocation is supported, and the account has model entitlement. Review the provider EULA and any Marketplace subscription in the Bedrock console before separately approving acceptance. The runtime roles intentionally cannot subscribe. Review Lambda regional concurrency availability: two functions each reserve two, and AWS requires capacity to remain available for unreserved functions. Do not silently remove the concurrency limits to work around a quota error.

3. **Prepare a disabled, private change set.** Run local checks and schema/security validation first. After authorization, create the protected local parameters file without printing the secret or placing it in shell history:

   ```bash
   python3 - <<'PY'
   import json, os, secrets
   params = [
       {"ParameterKey": "AllowedOrigin", "ParameterValue": "https://elliottbarnes.ca"},
       {"ParameterKey": "GenerationEnabled", "ParameterValue": "false"},
       {"ParameterKey": "PublicDemoAccess", "ParameterValue": "false"},
       {"ParameterKey": "IPHashSecret", "ParameterValue": secrets.token_urlsafe(48)},
   ]
   fd = os.open('.aws-live/create-parameters.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
   with os.fdopen(fd, 'w') as target:
       json.dump(params, target)
   PY
   aws cloudformation validate-template --template-body file://.aws-live/template.json --profile live-demo-admin --region us-west-2
   aws cloudformation create-change-set --stack-name portfolio-live-demo-lab --change-set-name disabled-private-review --change-set-type CREATE --template-body file://.aws-live/template.json --parameters file://.aws-live/create-parameters.json --capabilities CAPABILITY_IAM --profile live-demo-admin --region us-west-2
   aws cloudformation wait change-set-create-complete --stack-name portfolio-live-demo-lab --change-set-name disabled-private-review --profile live-demo-admin --region us-west-2
   aws cloudformation describe-change-set --stack-name portfolio-live-demo-lab --change-set-name disabled-private-review --profile live-demo-admin --region us-west-2
   aws cloudformation describe-events --stack-name portfolio-live-demo-lab --change-set-name disabled-private-review --profile live-demo-admin --region us-west-2
   ```

   Review the complete proposed resource changes, IAM policies and pre-deployment validation results. Use a recent AWS CLI for `describe-events`; do not treat local syntax validation as deployment approval. The source region map and model policy are fixed to Oregon.

4. **Create resources only after approving the reviewed change set.** The following starts billable infrastructure and is not part of the current task:

   ```bash
   aws cloudformation execute-change-set --stack-name portfolio-live-demo-lab --change-set-name disabled-private-review --profile live-demo-admin --region us-west-2
   aws cloudformation wait stack-create-complete --stack-name portfolio-live-demo-lab --profile live-demo-admin --region us-west-2
   aws cloudformation describe-stacks --stack-name portfolio-live-demo-lab --query 'Stacks[0].Outputs' --profile live-demo-admin --region us-west-2
   ```

   Keep both flags false. Verify IAM-signed `GET /health` reports `enabled:false`; unauthorized requests must be rejected and a signed generation request must report generation disabled. Do not place signing credentials into the demo client. Do not alter public-site endpoint or CSP settings.

5. **Test paid generation privately only after a further explicit opt-in.** Prepare an UPDATE change set with `GenerationEnabled=true`, `PublicDemoAccess=false`, and `UsePreviousValue:true` for `AllowedOrigin` and `IPHashSecret`. Review and execute it through the same change-set process. Use an IAM-signed test client for one generation, replay the identical request ID, confirm it reuses the job, and verify the image, seed, filtering/error handling, short-lived link and logs. This spends model allowance and incurs AWS charges. Re-disable generation after the check. Do not reset counters or raise allowances merely to bypass a failing test.

6. **Decide frontend access separately.** Browser testing against a deployed API requires an approved authentication design and explicitly configured endpoint/CSP. Test phone-sized and Mac layouts, loading and failure states, duplicate clicks and allowance exhaustion before any public connection. The existing unsigned client and IAM-default template are intentionally disconnected; public access remains unapproved. Do not set `PublicDemoAccess=true`, publish an API URL, merge or deploy the website as part of this reference procedure.

For a future shutdown, update `GenerationEnabled=false` in both functions through a reviewed change set. If active abuse requires an immediate stop, an authorized administrator can first set the worker's reserved concurrency to zero using the `WorkerFunctionName` output, then reconcile that emergency change in CloudFormation. This stops worker execution rather than deleting data; already-running model requests may finish and be billed, and API traffic can still have costs. Removing an endpoint from the webpage alone does not stop callers who already know it.

Do not rotate the IP hash secret during a UTC day without accounting for the resulting reset of per-IP allowance. Never replace the DynamoDB table or clear allowance counters during an active paid month merely to refresh the environment. Preserve them through updates, and inspect any table replacement in a change set before execution.
