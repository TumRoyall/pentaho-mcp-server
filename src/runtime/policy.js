/**
 * Execution requires two independent boundaries:
 *   - the server operator opts in (`PENTAHO_ENABLE_EXECUTE=1` -> executeEnabled)
 *   - the individual call asserts `confirmed: true`
 *
 * `confirmed` is only a caller assertion, not proof of human approval, so it is
 * meaningless without the server-side opt-in. The two states are kept distinct
 * so callers can tell "the host forbids execution" (EXECUTE_DISABLED) apart
 * from "the host allows it but you must confirm" (CONFIRM_REQUIRED).
 */
export function executionPolicy({ confirmed = false, executeEnabled = false } = {}) {
  if (executeEnabled !== true) return 'EXECUTE_DISABLED';
  if (confirmed !== true) return 'CONFIRM_REQUIRED';
  return 'ALLOW';
}
