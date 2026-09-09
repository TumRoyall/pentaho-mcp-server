/**
 * Fixed-size streaming tail buffer.
 *
 * `execute` must never accumulate an unbounded string before slicing: a
 * runaway PDI process can emit gigabytes of stdout/stderr. `createTailBuffer`
 * keeps at most `maxBytes` bytes of the *tail* (the most recent output), which
 * is the diagnostically useful end of a Kitchen/Pan log. Every `append` bounds
 * memory immediately by discarding the oldest bytes.
 *
 * Bytes are the unit of truth so a UTF-8 multibyte sequence never inflates the
 * cap; a boundary split mid-character is decoded leniently by `value()`.
 */
export function createTailBuffer(maxBytes) {
  const limit = Math.max(1, Number(maxBytes) || 0);
  let buffer = Buffer.alloc(0);
  return {
    append(chunk) {
      if (chunk == null) return;
      const incoming = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
      if (incoming.length >= limit) {
        // The new chunk alone overflows the cap: keep only its own tail.
        buffer = incoming.subarray(incoming.length - limit);
        return;
      }
      const combined = Buffer.concat([buffer, incoming]);
      buffer = combined.length > limit ? combined.subarray(combined.length - limit) : combined;
    },
    value() {
      return buffer.toString('utf8');
    },
  };
}
