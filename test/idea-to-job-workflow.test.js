import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
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
