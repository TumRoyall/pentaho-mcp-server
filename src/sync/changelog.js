export function prependChange(existing, deltas, version) {
  const ids = [...String(existing ?? '').matchAll(/CHG-(\d{3,})/g)].map(match => Number(match[1]));
  const id = `CHG-${String((ids.length ? Math.max(...ids) : 0) + 1).padStart(3, '0')}`;
  const entry = `## ${id} — Runtime/design synchronization\n\n- Mode: Manual Runtime Sync\n- Design version: ${version}\n- Validation: PASS\n- Changes:\n${deltas.map(item => `  - ${item.componentId}/${item.path}: ${JSON.stringify(item.oldValue)} → ${JSON.stringify(item.newValue)}`).join('\n')}\n\n`;
  if (!existing) return `---\nartifact_type: pentaho-changelog\n---\n# Changelog\n\n${entry}`;
  const heading = existing.indexOf('# Changelog');
  if (heading < 0) return `${entry}${existing}`;
  const insert = existing.indexOf('\n', heading) + 1;
  return `${existing.slice(0, insert)}\n${entry}${existing.slice(insert).replace(/^\n+/, '')}`;
}
