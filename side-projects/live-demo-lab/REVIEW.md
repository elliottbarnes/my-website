# Local prototype review

Reviewed 2026-09-28. This records local checks, not an AWS deployment or a production release.

## Verified

- All 126 JavaScript tests passed from the repository root, including browser-client retry/cancellation tests, infrastructure packaging checks and production-isolation tests.
- All 43 Python backend tests passed without AWS credentials or cloud calls. These cover concurrent quota reservations, duplicate workers, validation, failure handling, output parsing and signed-link behavior with test services.
- The packaged CloudFormation document is 32,748 bytes, below the inline body limit. Tests decode and import its exact Python source. The readable template has generation off and IAM authentication on by default.
- The portfolio build and verifier passed with the same 30 public files. No lab assets, infrastructure or backend source are in that artifact. This task changed no production HTML, CSS or JavaScript.
- The lab server binds to loopback, serves only its explicit frontend list, rejects POST requests and private source paths, and sets `connect-src 'none'`. The image API address is empty and Generate is disabled.
- CI now runs the offline backend tests as part of its existing read-only check job. The deployment job is unchanged; no infrastructure workflow was added.

## Browser checks on Mac

In the in-app browser:

| Viewport | Result |
|---|---|
| 320 × 740 | CSV reconciliation correctly reported a one-cent difference and missing records on both sides. Custom queue pattern accepted a 100-request burst and rejected invalid input. No horizontal document or dialog overflow. |
| 390 × 844 | Custom answer comparison correctly reported one failed and one passing required phrase. Editors use 16px text. Prism randomizes a nonzero seed, keeps the draft across dialog close/reopen, and leaves paid generation disabled. |
| 1280px desktop | Two-column project layout, correct local-prototype status, no horizontal document overflow and no browser error/warning logs on the clean preview. |

Keyboard activation and Escape-to-close worked; closing returned focus to the launching project. Temporary viewport overrides were reset after review. Screenshots are local review evidence under the repository's ignored `.design/live-demo-lab/` directory.

## Not verified

No AWS resources, model subscriptions, paid invocations, account permissions or deployed API behavior were tested. DynamoDB concurrency is tested with an atomic in-memory store, plus offline SDK serialization checks. Actual model output has not been sampled. Interlaced PNGs intentionally fail validation.

CloudFormation schema tooling (`cfn-lint`/`cfn-guard`) was unavailable; source/template boundary tests are not a substitute for service-side validation. Native Safari automation did not successfully navigate to the lab, so Safari is not counted as passed. Physical phones, mobile keyboards and assistive-technology testing remain unverified.

Before any future cloud testing, obtain explicit approval for an isolated environment, access method and spending allowance. Public paid generation remains out of scope.
