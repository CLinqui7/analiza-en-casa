# API rules

- Validate all inputs and return generic public errors where enumeration is possible.
- Keep privileged credentials server-side only.
- Require organization scope and permission checks for protected operations.
- Use idempotency for notifications, payments and retry jobs.
- Do not log sensitive clinical or authentication data.
- Add deterministic tests for every changed endpoint.
