export function executionPolicy(environment, confirmed = false) {
  const name = String(environment ?? 'UNKNOWN').toUpperCase();
  return confirmed || name === 'DEV' || name === 'TEST' ? 'ALLOW' : 'CONFIRM_REQUIRED';
}
