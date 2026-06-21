# Expected AI Comment Shape

The exact wording depends on the model, but the PR comment should say roughly:

## Root cause

The checkout UI rejects `sam@example.com` after the PR changes customer email validation to require `@company.test`.

## Evidence

- Playwright submitted `sam@example.com` in the priority checkout flow.
- The UI rendered `Use a valid customer email address.` instead of `Order confirmed for Sam Developer.`
- The service diff changed `isValidCustomerEmail` from a standard email regex to `normalized.endsWith("@company.test")`.

## Suggested fix

Restore standard customer email validation, or update product requirements and tests together if the company-domain restriction is intentional.
