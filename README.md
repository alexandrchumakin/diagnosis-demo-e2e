# Diagnosis Demo E2E

Reusable Playwright E2E workflow with AI failure diagnosis.

This repo is designed to be called from `diagnosis-demo-service`:

```yaml
jobs:
  checkout-e2e:
    uses: alexandrchumakin/diagnosis-demo-e2e/.github/workflows/run-e2e.yml@main
    with:
      service_repository: ${{ github.repository }}
      service_ref: ${{ github.event.pull_request.head.sha || github.sha }}
      service_base_ref: ${{ github.event.pull_request.base.sha || '' }}
    secrets:
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Run Locally Against the Sibling Service Repo

Run the clean green scenario. This command starts its own service container inside the Compose network; you do not need to start `diagnosis-demo-service` separately for E2E.

```bash
npm install
npm run test:docker
```

If you only want to show the UI in a browser, start `diagnosis-demo-service` with its own `docker compose up --build` and open http://localhost:4173.

## Run a Visible Browser Demo

Start the service first:

```bash
cd ../diagnosis-demo-service
docker compose up --build
```

Then run Playwright on the host in headed slow-motion mode:

```bash
cd ../diagnosis-demo-e2e
npm run setup:browsers
npm run test:demo
```

This uses `BASE_URL=http://localhost:4173`, opens a visible Chromium window, disables retries, and adds `slowMo` so the clicks are readable for an audience. `setup:browsers` is needed once per machine because the headed demo runs on the host, not inside the Playwright Docker image.

IntelliJ IDEA users can run the shared `Playwright demo (headed slow)` run configuration after the service is started.

Artifacts are written to:

```text
artifacts/
test-results/
playwright-report/
```

## Analyze a Failure Locally

After a failing run:

```bash
OPENAI_API_KEY=... npm run analyze:local
```

If `OPENAI_API_KEY` is not set, the analyzer writes a deterministic fallback summary so the workflow still publishes useful artifacts.

## GitHub Behavior

The reusable workflow:

1. Checks out the service PR commit.
2. Starts the service with Docker Compose.
3. Runs Playwright tests.
4. Collects JUnit XML, Playwright output, service logs, and a service diff.
5. Calls OpenAI Responses API when tests fail.
6. Adds the AI diagnosis to the job summary and updates a PR comment.
7. Fails the check only after the diagnosis is published.
