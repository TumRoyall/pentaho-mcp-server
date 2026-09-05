const escapeXml = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const yn = value => value === false ? 'N' : 'Y';

function parameters(rows = []) {
  return rows.map(row => `    <parameter><name>${escapeXml(row.name)}</name><default_value/><description/></parameter>`).join('\n');
}

function connectionXml(rows = []) {
  return rows.map(row => `  <connection><name>${escapeXml(row.name)}</name></connection>`).join('\n');
}

export function generateJobXml(doc, manifest) {
  const job = doc.job;
  const names = new Map(job.entries.map(entry => [entry.id, entry.display_name]));
  const artifacts = new Map([
    ...(manifest.components?.jobs ?? []), ...(manifest.components?.transformations ?? []),
  ].map(row => [row.id, row.artifact_name]));
  const entries = job.entries.map((entry, index) => {
    const name = escapeXml(entry.display_name);
    const type = entry.pentaho_entry_type;
    const base = [`    <entry>`, `      <name>${name}</name>`, `      <type>${escapeXml(type === 'START' ? 'SPECIAL' : type === 'FAILURE' ? 'SPECIAL' : type)}</type>`];
    if (type === 'SPECIAL' || type === 'START') base.push('      <start>Y</start><dummy>N</dummy>');
    else if (type === 'FAILURE') base.push('      <start>N</start><dummy>Y</dummy>');
    if (type === 'TRANS') {
      const artifact = artifacts.get(entry.component_ref);
      if (!artifact) throw new Error(`Missing artifact for component_ref ${entry.component_ref}`);
      base.push('      <specification_method>filename</specification_method>');
      base.push(`      <filename>\${Internal.Entry.Current.Directory}/${escapeXml(artifact)}</filename>`);
      base.push('      <wait_until_finished>Y</wait_until_finished><parameters><pass_all_parameters>Y</pass_all_parameters></parameters>');
    }
    base.push(`      <parallel>N</parallel><draw>Y</draw><xloc>${80 + index * 160}</xloc><yloc>100</yloc>`, '    </entry>');
    return base.join('\n');
  }).join('\n');
  const hops = (job.hops ?? []).map(hop => {
    const from = names.get(hop.from); const to = names.get(hop.to);
    if (!from || !to) throw new Error(`Dangling job hop ${hop.from} -> ${hop.to}`);
    const unconditional = hop.type === 'unconditional' ? 'Y' : 'N';
    const evaluation = hop.type === 'failure' ? 'N' : 'Y';
    return `    <hop><from>${escapeXml(from)}</from><to>${escapeXml(to)}</to><enabled>${yn(hop.enabled)}</enabled><evaluation>${evaluation}</evaluation><unconditional>${unconditional}</unconditional></hop>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<job>
  <name>${escapeXml(job.name ?? job.artifact_name.replace(/\.kjb$/i, ''))}</name>
  <parameters>
${parameters(job.parameters)}
  </parameters>
${connectionXml(manifest.connections)}
  <entries>
${entries}
  </entries>
  <hops>
${hops}
  </hops>
</job>
`;
}
