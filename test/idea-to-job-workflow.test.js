import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createWorkspaceBoundary } from '../src/workspace/boundary.js';
import { buildTools } from '../src/tools/registry.js';

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function workspace() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'kettle-idea-to-job-'));
  dirs.push(root);
  return root;
}

// Handlers may throw synchronously (at the boundary) or return a promise;
// normalize both so the flow reads sequentially.
const call = (tools, name, args) => Promise.resolve().then(() => tools.get(name).handler(args));

test('knowledge-first primitive sequence builds a statically valid job+transformation', async () => {
  const root = workspace();
  const context = createWorkspaceBoundary(root);
  const tools = new Map(buildTools(context).map(tool => [tool.name, tool]));

  // No lifecycle tool is part of this workflow's registry.
  assert.equal([...tools.keys()].some(name => name.startsWith('pentaho_')), false);

  // 1. Consult the catalog for every distinct type before using it.
  for (const [kind, type] of [['trans', 'RowGenerator'], ['trans', 'Dummy'], ['job', 'SPECIAL'], ['job', 'TRANS']]) {
    const ref = await call(tools, 'kettle_knowledge_get', { kind, type });
    assert.ok(ref.entry, `knowledge_get should resolve ${kind}/${type}`);
    assert.equal(ref.entry.xml_type, type);
  }

  // 2. Create the leaf transformation and the orchestration job.
  const ktr = 'load_customer.ktr';
  const kjb = 'main.kjb';
  await call(tools, 'kettle_create_file', { path: ktr, kind: 'trans', name: 'load_customer' });
  await call(tools, 'kettle_create_file', { path: kjb, kind: 'job', name: 'main' });
  assert.ok(existsSync(path.join(root, ktr)));
  assert.ok(existsSync(path.join(root, kjb)));

  // 3. Add the two steps to the transformation.
  await call(tools, 'kettle_add_element', { path: ktr, type: 'RowGenerator', name: 'GENERATE_CUSTOMER' });
  await call(tools, 'kettle_add_element', { path: ktr, type: 'Dummy', name: 'PASS_CUSTOMER' });

  // 4. Configure GENERATE_CUSTOMER via the catalog-verified <limit> field.
  await call(tools, 'kettle_set_field', { path: ktr, name: 'GENERATE_CUSTOMER', field: 'limit', value: '2' });

  // 5. Normal transformation hop.
  await call(tools, 'kettle_edit_hops', { path: ktr, action: 'add', from: 'GENERATE_CUSTOMER', to: 'PASS_CUSTOMER' });

  // 6. Add the TRANS entry and point its <filename> at the leaf transformation.
  await call(tools, 'kettle_add_element', { path: kjb, type: 'TRANS', name: 'LOAD_CUSTOMER' });
  await call(tools, 'kettle_set_field', {
    path: kjb,
    name: 'LOAD_CUSTOMER',
    field: 'filename',
    value: '${Internal.Entry.Current.Directory}/load_customer.ktr',
  });

  // 7. START -> LOAD_CUSTOMER job hop.
  await call(tools, 'kettle_edit_hops', { path: kjb, action: 'add', from: 'START', to: 'LOAD_CUSTOMER' });

  // 8. Static validation: per file and whole tree, zero structural errors.
  const ktrReport = await call(tools, 'kettle_validate', { path: ktr });
  const kjbReport = await call(tools, 'kettle_validate', { path: kjb });
  const treeReport = await call(tools, 'kettle_validate', {});

  assert.equal(ktrReport.summary.errors, 0, JSON.stringify(ktrReport.issues));
  assert.equal(kjbReport.summary.errors, 0, JSON.stringify(kjbReport.issues));
  assert.equal(treeReport.summary.errors, 0, JSON.stringify(treeReport.files));
});

// A minimal in-root source transformation carrying ONE top-level <connection>
// whose password is a ${VARIABLE} placeholder (never plaintext). This is the
// fixture kettle_copy_connection reads from; nothing here touches a database.
function connectionSourceXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<transformation>',
    '  <info>',
    '    <name>conn_source</name>',
    '  </info>',
    '  <connection>',
    '    <name>DW</name>',
    '    <server>${DW_HOST}</server>',
    '    <type>POSTGRESQL</type>',
    '    <access>Native</access>',
    '    <database>${DW_DB}</database>',
    '    <port>5432</port>',
    '    <username>${DW_USER}</username>',
    '    <password>${DW_PASSWORD}</password>',
    '  </connection>',
    '  <order>',
    '  </order>',
    '</transformation>',
    '',
  ].join('\n');
}

test('end-to-end: create trans, set parameters, copy a placeholder connection, wire TableInput->TableOutput, validate clean', async () => {
  const root = workspace();
  const context = createWorkspaceBoundary(root);
  const tools = new Map(buildTools(context).map(tool => [tool.name, tool]));

  // Seed the in-root connection source fixture (placeholder-only password).
  writeFileSync(path.join(root, 'conn_source.ktr'), connectionSourceXml(), 'utf8');

  const ktr = 'stage_orders.ktr';

  // 1. Create the transformation from scratch.
  await call(tools, 'kettle_create_file', { path: ktr, kind: 'trans', name: 'stage_orders' });
  assert.ok(existsSync(path.join(root, ktr)));

  // 2. Declare artifact-level parameters.
  await call(tools, 'kettle_set_parameters', {
    path: ktr,
    parameters: [
      { name: 'RUN_DATE', default: '2026-09-09', description: 'Business date' },
      { name: 'BATCH_SIZE', default: '1000', description: 'Rows per commit' },
    ],
  });

  // 3. Copy the placeholder-only connection into the new transformation.
  const copyResult = await call(tools, 'kettle_copy_connection', {
    sourcePath: 'conn_source.ktr',
    destPath: ktr,
    sourceName: 'DW',
  });
  assert.match(copyResult.diff, /DW/);

  // 4. Add a TableInput and a TableOutput step.
  await call(tools, 'kettle_add_element', { path: ktr, type: 'TableInput', name: 'READ_ORDERS' });
  await call(tools, 'kettle_add_element', { path: ktr, type: 'TableOutput', name: 'WRITE_ORDERS' });

  // 5. Point both steps at the copied connection by name.
  await call(tools, 'kettle_set_field', { path: ktr, name: 'READ_ORDERS', field: 'connection', value: 'DW' });
  await call(tools, 'kettle_set_field', { path: ktr, name: 'WRITE_ORDERS', field: 'connection', value: 'DW' });

  // 6. Wire the hop.
  await call(tools, 'kettle_edit_hops', { path: ktr, action: 'add', from: 'READ_ORDERS', to: 'WRITE_ORDERS' });

  // 7. Static validation: zero structural errors. No DB, no PDI process.
  const report = await call(tools, 'kettle_validate', { path: ktr });
  assert.equal(report.summary.errors, 0, JSON.stringify(report.issues));

  // The parameters and the copied (still-placeholder) connection are present;
  // no plaintext password was introduced.
  const finalXml = readFileSync(path.join(root, ktr), 'utf8');
  assert.match(finalXml, /<name>RUN_DATE<\/name>/);
  assert.match(finalXml, /<name>BATCH_SIZE<\/name>/);
  assert.match(finalXml, /<password>\$\{DW_PASSWORD\}<\/password>/);
});
