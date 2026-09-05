const escapeXml = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const yn = value => value === false ? 'N' : 'Y';

function connectionXml(rows = []) {
  return rows.map(row => `  <connection><name>${escapeXml(row.name)}</name></connection>`).join('\n');
}

function tableInput(step) {
  const cfg = step.configuration ?? {};
  return `      <connection>${escapeXml(cfg.connection)}</connection>
      <sql>${escapeXml(cfg.query_contract)}</sql>
      <limit>0</limit><execute_each_row>N</execute_each_row><variables_active>${/\$\{/.test(cfg.query_contract ?? '') ? 'Y' : 'N'}</variables_active>`;
}

function tableOutput(step) {
  const cfg = step.configuration ?? {};
  const [schema = '', ...tableParts] = String(cfg.target_object ?? '').split('.');
  const table = tableParts.join('.') || schema;
  const actualSchema = tableParts.length ? schema : '';
  const fields = (cfg.field_mapping ?? []).map(row => `        <field><column_name>${escapeXml(row.target_field)}</column_name><stream_name>${escapeXml(row.stream_field)}</stream_name></field>`).join('\n');
  return `      <connection>${escapeXml(cfg.connection)}</connection>
      <schema>${escapeXml(actualSchema)}</schema><table>${escapeXml(table)}</table>
      <commit>${escapeXml(cfg.commit_size ?? 1000)}</commit><truncate>${cfg.truncate_table === true ? 'Y' : 'N'}</truncate>
      <ignore_errors>N</ignore_errors><use_batch>Y</use_batch><specify_fields>Y</specify_fields>
      <fields>\n${fields}\n      </fields>`;
}

export function generateTransformationXml(doc, manifest) {
  const trans = doc.transformation;
  const names = new Map(trans.steps.map(step => [step.id, step.display_name]));
  const steps = trans.steps.map((step, index) => {
    let config = '';
    if (step.pentaho_step_type === 'TableInput' || step.pentaho_step_type === 'TABLE_INPUT') config = tableInput(step);
    else if (step.pentaho_step_type === 'TableOutput' || step.pentaho_step_type === 'TABLE_OUTPUT') config = tableOutput(step);
    return `  <step>
    <name>${escapeXml(step.display_name)}</name><type>${escapeXml(step.pentaho_step_type)}</type>
${config}
    <GUI><xloc>${80 + index * 180}</xloc><yloc>100</yloc><draw>Y</draw></GUI>
  </step>`;
  }).join('\n');
  const hops = (trans.hops ?? []).map(hop => {
    const from = names.get(hop.from); const to = names.get(hop.to);
    if (!from || !to) throw new Error(`Dangling transformation hop ${hop.from} -> ${hop.to}`);
    return `    <hop><from>${escapeXml(from)}</from><to>${escapeXml(to)}</to><enabled>${yn(hop.enabled)}</enabled></hop>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>${escapeXml(trans.name ?? trans.artifact_name.replace(/\.ktr$/i, ''))}</name><parameters></parameters></info>
  <order>
${hops}
  </order>
${steps}
${connectionXml(manifest.connections)}
</transformation>
`;
}
