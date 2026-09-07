export function executionPolicy(confirmed = false) {
  return confirmed === true ? 'ALLOW' : 'CONFIRM_REQUIRED';
}
