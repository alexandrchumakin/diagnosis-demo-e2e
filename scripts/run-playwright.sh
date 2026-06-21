#!/usr/bin/env bash
set -euo pipefail

mkdir -p artifacts
set +e
npm test 2>&1 | tee artifacts/playwright-output.log
test_exit_code=${PIPESTATUS[0]}
set -e

exit "$test_exit_code"
