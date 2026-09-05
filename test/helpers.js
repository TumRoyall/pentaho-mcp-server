import assert from 'node:assert/strict';

/**
 * Assert only the expected lines changed, and prove it positionally: every
 * line before the first difference and every line after the last difference
 * must be byte-identical at the same index in `before` and `after`. Set-
 * membership alone can't catch reordering or duplicate-count changes, so this
 * walks in from both ends (same technique as edit.js's own unifiedDiff) to
 * find the true common prefix/suffix, then checks only the region between.
 */
export function assertMinimalDiff(before, after, expectedChangedSubstrings) {
  const b = before.split('\n');
  const a = after.split('\n');
  let p = 0;
  while (p < b.length && p < a.length && b[p] === a[p]) p++;
  let s = 0;
  while (s < b.length - p && s < a.length - p && b[b.length - 1 - s] === a[a.length - 1 - s]) s++;
  const removed = b.slice(p, b.length - s);
  const added = a.slice(p, a.length - s);
  for (const str of expectedChangedSubstrings) {
    assert.ok(added.some(l => l.includes(str)), `expected a changed line containing: ${str}\nchanged: ${JSON.stringify(added)}`);
  }
  assert.ok(added.length <= expectedChangedSubstrings.length, `changed region larger than expected: ${JSON.stringify(added)}`);
  assert.ok(removed.length <= expectedChangedSubstrings.length, `too many lines removed: ${JSON.stringify(removed)}`);
}
