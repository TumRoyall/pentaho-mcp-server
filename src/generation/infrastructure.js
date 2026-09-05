const escapeXml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function generateSharedXml(connections = []) {
  const body = connections.map(row => {
    const vars = row.variables ?? {};
    return `  <connection><name>${escapeXml(row.name)}</name><server>\${${escapeXml(vars.host ?? `${row.name}_HOST`)}}</server><type>${escapeXml(row.technology ?? 'ORACLE')}</type><access>Native</access><database>\${${escapeXml(vars.database ?? `${row.name}_DATABASE`)}}</database><port>\${${escapeXml(vars.port ?? `${row.name}_PORT`)}}</port><username>\${${escapeXml(vars.username ?? `${row.name}_USER`)}}</username><password>\${${escapeXml(vars.password ?? `${row.name}_PASSWORD`)}}</password></connection>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sharedobjects>\n${body}\n</sharedobjects>\n`;
}

export function generateProperties(manifest) {
  const names = new Set();
  for (const connection of manifest.connections ?? []) for (const value of Object.values(connection.variables ?? {})) names.add(value);
  for (const parameter of manifest.parameters ?? []) names.add(parameter.name);
  return [...names].sort().map(name => `${name}=`).join('\n') + '\n';
}

export function launchers(entrypoint) {
  return {
    'runjob.bat': `@echo off\r\n"%~dp0\\..\\kitchen.bat" /file:"%~dp0${entrypoint}" %*\r\n`,
    'spoon.bat': '@echo off\r\nstart "" spoon.bat\r\n',
    'spoon.sh': '#!/usr/bin/env sh\nspoon.sh\n',
  };
}

export function generateDdl(pkg) {
  const files = {};
  const advisory = ['# DDL advisory', '', 'Review indexes and partitioning with the DBA before deployment.'];
  for (const doc of pkg.transformations.values()) {
    for (const output of doc.transformation?.outputs ?? []) {
      if (!output.object || !(output.fields ?? []).length) continue;
      const columns = output.fields.map(field => `  ${field.name} ${field.type ?? 'VARCHAR2(4000)'}${field.nullable === false ? ' NOT NULL' : ''}`);
      const primary = (output.key_fields ?? []).length ? `,\n  PRIMARY KEY (${output.key_fields.join(', ')})` : '';
      files[`ddl/${output.object}.sql`] = `CREATE TABLE ${output.object} (\n${columns.join(',\n')}${primary}\n);\n`;
      advisory.push('', `- ${output.object}: review keys, indexes, tablespace, and partition policy.`);
    }
  }
  if (Object.keys(files).length) files['ddl/ddl_advisory.md'] = `${advisory.join('\n')}\n`;
  return files;
}
