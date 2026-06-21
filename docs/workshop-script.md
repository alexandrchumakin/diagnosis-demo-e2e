# Workshop Demo Script

## Message

QA-owned E2E tests should not just block a PR. They should explain the risk in developer language, with enough evidence to fix the problem without a handoff meeting.

## Flow

1. Show the clean checkout UI.
2. Show the service workflow calling the reusable E2E workflow from the separate test repo.
3. Open a PR from `bug/restrict-customer-email` to `main`.
4. The PR check fails after Playwright submits `sam@example.com`.
5. Open the AI diagnosis comment or job summary.
6. Point out the evidence chain: failed assertion, service diff, suggested fix.

## Talk Track

The test is intentionally not a CRUD unit test. It covers the user-visible checkout flow that needs a running UI. The AI step does not replace the test; it translates the failure artifacts into a compact root-cause hypothesis for the service developer.

The useful part is process design: developers get failure context at PR creation time, QA avoids repetitive "why did the test fail?" debugging, and both sides discuss product behavior instead of CI archaeology.
