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

/**
 * Locate a DIRECT child element `childTag` within `parentSpan` (depth one),
 * ignoring same-named descendants nested deeper. Unlike findChildSpan (which
 * returns the first textual occurrence and can reach a grandchild), this walks
 * tokens from parentSpan.start to parentSpan.end tracking element depth, and
 * returns only a match whose opening tag sits at depth one relative to the
 * parent's own content. Comments, declarations/DOCTYPE, CDATA, and self-closing
 * tags of other names do not change the depth and are skipped; a self-closing
 * `<childTag/>` at depth one is a valid (empty) direct child.
 *
 * Returns the same shape findChildSpan returns:
 *   { start, end, inner: { start, end }, selfClosing }
 * or null when no direct child exists.
 *
 * The scanner assumes Kettle's machine-generated XML: container tags carry no
 * attributes, so an opening tag is `<tag>` or `<tag/>` with optional trailing
 * whitespace before `>`. That matches the rest of this module's contract.
 */
export function findDirectChildSpan(xml, parentSpan, childTag) {
  const end = parentSpan.end;
  let i = parentSpan.start;
  // Depth 0 is the parent element itself. Its own opening tag is the first
  // token we meet; after it, direct children live at depth 1.
  let depth = 0;
  let sawParentOpen = false;

  while (i < end) {
    const lt = xml.indexOf('<', i);
    if (lt === -1 || lt >= end) break;

    // Comment: <!-- ... -->
    if (xml.startsWith('<!--', lt)) {
      const close = xml.indexOf('-->', lt + 4);
      i = close === -1 ? end : close + 3;
      continue;
    }
    // CDATA: <![CDATA[ ... ]]>
    if (xml.startsWith('<![CDATA[', lt)) {
      const close = xml.indexOf(']]>', lt + 9);
      i = close === -1 ? end : close + 3;
      continue;
    }
    // Declaration / DOCTYPE: <! ... > and processing instruction <? ... ?>
    if (xml[lt + 1] === '!' || xml[lt + 1] === '?') {
      const close = xml.indexOf('>', lt + 2);
      i = close === -1 ? end : close + 1;
      continue;
    }

    const gt = xml.indexOf('>', lt);
    if (gt === -1 || gt >= end) break;
    const isClose = xml[lt + 1] === '/';
    const selfClosing = xml[gt - 1] === '/';
    // Tag name = leading run of name chars after '<' (or '</').
    const nameStart = lt + (isClose ? 2 : 1);
    let ns = nameStart;
    while (ns < gt && /[^\s/>]/.test(xml[ns])) ns++;
    const name = xml.slice(nameStart, ns);

    if (isClose) {
      depth--;
      i = gt + 1;
      continue;
    }

    if (!sawParentOpen) {
      // This first opening tag is the parent element itself.
      sawParentOpen = true;
      if (!selfClosing) depth = 1; // now inside the parent -> children at depth 1
      i = gt + 1;
      continue;
    }

    // An opening (or self-closing) tag inside the parent.
    if (depth === 1 && name === childTag) {
      if (selfClosing) {
        return { start: lt, end: gt + 1, inner: { start: gt + 1, end: gt + 1 }, selfClosing: true };
      }
      const close = `</${childTag}>`;
      const k = xml.indexOf(close, gt + 1);
      if (k === -1 || k >= end) throw new Error(`Unclosed <${childTag}> inside span`);
      return {
        start: lt,
        end: k + close.length,
        inner: { start: gt + 1, end: k },
        selfClosing: false,
      };
    }

    if (!selfClosing) depth++;
    i = gt + 1;
  }
  return null;
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
