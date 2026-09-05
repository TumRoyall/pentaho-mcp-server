/**
 * Locate exact character ranges of elements in raw Kettle XML text.
 *
 * Safe because Kettle files are machine-generated:
 *  - <step>/<entry>/<hop> never nest inside themselves
 *  - these container tags never carry attributes
 *  - <name> is always the first child of a step/entry
 *  - all text content is entity-escaped (no CDATA), so tag strings
 *    can never appear inside SQL or other values
 */

export function findAllSpans(xml, tag) {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const spans = [];
  let i = 0;
  while ((i = xml.indexOf(open, i)) !== -1) {
    const end = xml.indexOf(close, i);
    if (end === -1) throw new Error(`Unclosed <${tag}> at offset ${i}`);
    spans.push({ start: i, end: end + close.length });
    i = end + close.length;
  }
  return spans;
}

// Returns the *first occurrence* of `childTag` within `span`, not strictly a
// direct child — e.g. on a step whose <fields> contains a nested element of
// the same tag name, this can reach that grandchild instead of a same-named
// direct child declared later. This is why setField() on a field-shaped name
// can hit something inside <fields> rather than the direct child intended.
export function findChildSpan(xml, span, childTag) {
  const seg = xml.slice(span.start, span.end);
  const open = `<${childTag}>`;
  const selfClose = `<${childTag}/>`;
  const i = seg.indexOf(open);
  const j = seg.indexOf(selfClose);
  if (i === -1 && j === -1) return null;
  if (i === -1 || (j !== -1 && j < i)) {
    const abs = span.start + j;
    const end = abs + selfClose.length;
    return { start: abs, end, inner: { start: end, end }, selfClosing: true };
  }
  const close = `</${childTag}>`;
  const k = seg.indexOf(close, i);
  if (k === -1) throw new Error(`Unclosed <${childTag}> inside span`);
  return {
    start: span.start + i,
    end: span.start + k + close.length,
    inner: { start: span.start + i + open.length, end: span.start + k },
    selfClosing: false,
  };
}

export function innerText(xml, span, childTag) {
  const c = findChildSpan(xml, span, childTag);
  return c ? xml.slice(c.inner.start, c.inner.end) : null;
}

export function findElementSpan(xml, tag, name) {
  for (const span of findAllSpans(xml, tag)) {
    const n = innerText(xml, span, 'name');
    if (n != null && unescapeXml(n) === name) return span;
  }
  return null;
}

export function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function unescapeXml(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}
