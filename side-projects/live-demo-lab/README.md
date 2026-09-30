# Live Demo Lab

A local side project for the portfolio. **No AWS resources are deployed, no paid generation is connected, and this folder is excluded from the production website artifact.**

## Try it

From the website repository:

```bash
node side-projects/live-demo-lab/server.mjs
```

Open http://127.0.0.1:4190. The server binds only to this computer and serves an explicit list of frontend files. Backend source, infrastructure, tests and documentation are not served. Its Content Security Policy blocks all outgoing API requests (`connect-src 'none'`), and the API address in the page is empty.

## Experiments

- **Batchline:** customize a repeating traffic pattern in a browser queue simulation. No model service is running.
- **EvalDeck:** compare your own text and check up to five required phrases locally. No AI judge or language model is called.
- **Reconcile Kit:** paste two `id,amount` CSVs and find duplicates, missing IDs and exact-cent mismatches locally. Up to 200 records per CSV; records are not uploaded.
- **Prism Studio:** edit a prompt and choose or randomize a real nonzero seed. The image-generation controls remain disconnected. The proposed backend returns actual image/model/settings metadata; no static image is presented as a generated result.

Inputs stay in browser memory and are lost on page reload. No analytics, credentials or external fonts are used by this prototype.

## Future AWS design

The [AWS design and review checklist](docs/LIVE_DEMOS_AWS.md) describes a possible pay-per-use service: HTTP API → Lambda → Bedrock, with DynamoDB admission limits and private expiring S3 output. Infrastructure and backend files are preparation only. The template defaults generation to disabled.

The proposed model is Stable Image Core in Oregon at US$0.04 per image at the last pricing check. The default maximum is 75 admitted attempts per UTC month (US$3 in model charges at that price), five per day globally and three per source IP per day. Failed/uncertain attempts still consume allowance. **These limits are not a US$5 cap on the AWS bill:** API requests, data delivery, storage, logs and abusive traffic can incur additional costs. AWS Budgets alerts are delayed notifications, not a real-time spending stop.

Before any deployment, review authentication or invite-only access, traffic abuse controls, current model terms/pricing, permissions and a spending allowance with the owner. Do not deploy, subscribe to a model, connect an endpoint or enable paid generation without explicit approval. The public website should remain separate from this prototype.

## Checks

From this folder:

```bash
node --test tests/*.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_live_backend.py'
node scripts/package-live-demos.mjs
```

Packaging creates a local CloudFormation template; it does not call AWS. Browser/client tests use fakes; backend tests use in-memory services and no AWS credentials. These checks do not establish model access or a working deployed AWS service.
