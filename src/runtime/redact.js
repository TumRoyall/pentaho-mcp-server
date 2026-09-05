export function redact(text, parameters = {}) {
  let result = String(text ?? '');
  for (const [key, value] of Object.entries(parameters)) {
    if (/password|passwd|secret|token|credential/i.test(key) && value != null && String(value)) {
      result = result.split(String(value)).join('[REDACTED]');
    }
  }
  return result
    .replace(/((?:password|passwd|secret|token|credential)\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/(\/param:[^=]*(?:password|secret|token)[^=]*=)[^\s]+/gi, '$1[REDACTED]');
}
