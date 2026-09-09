import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function rpc(id, method, params) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params });
}

const EXPECTED_TOOL_NAMES = [
  'kettle_add_element',
  'kettle_add_error_hop',
  'kettle_clone',
  'kettle_copy_connection',
  'kettle_create_file',
  'kettle_edit_error_hop',
  'kettle_edit_hops',
  'kettle_get_element',
  'kettle_knowledge_analyze_xml',
  'kettle_knowledge_coverage',
  'kettle_knowledge_get',
  'kettle_knowledge_list',
  'kettle_list',
  'kettle_remove_element',
  'kettle_rename_element',
  'kettle_runtime_detect',
  'kettle_runtime_execute',
  'kettle_runtime_loadcheck',
  'kettle_runtime_logs',
  'kettle_search',
  'kettle_set_field',
  'kettle_set_field_path',
  'kettle_set_fields',
  'kettle_set_parameters',
  'kettle_summary',
  'kettle_validate',
];

test('stdio smoke: initialize, 26 tools, and tool calls', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'kettle-smoke-'));
  copyFileSync(path.join(here, 'fixtures', 'mini.ktr'), path.join(root, 'mini.ktr'));
  writeFileSync(
    path.join(root, 'add.ktr'),
    '<transformation><info><name>x</name></info><order/></transformation>',
  );
  const proc = spawn(process.execPath, [path.join(here, '..', 'src', 'index.js')], {
    env: { ...process.env, KETTLE_ROOT: root },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  proc.stdin.write([
    rpc(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } }),
    rpc(2, 'tools/list', {}),
    rpc(3, 'tools/call', { name: 'kettle_summary', arguments: { path: 'mini.ktr' } }),
    rpc(4, 'tools/call', { name: 'kettle_summary', arguments: { path: 'does-not-exist.ktr' } }),
    rpc(5, 'tools/call', {
      name: 'kettle_add_element',
      arguments: { path: 'add.ktr', type: 'SetSessionVariableStep', name: 'SetSess', allowObserved: true },
    }),
    rpc(6, 'tools/call', {
      name: 'kettle_search',
      arguments: { query: 'TableInput', kind: 'step_type' },
    }),
  ].join('\n') + '\n');
  proc.stdin.end();

  try {
    let out = '';
    for await (const chunk of proc.stdout) out += chunk;
    const responses = out.split('\n').filter(l => l.trim().startsWith('{')).map(l => JSON.parse(l));

    const list = responses.find(r => r.id === 2);
    assert.equal(list.result.tools.length, 26);
    // Assert the EXACT advertised tool set, not just the count, so an
    // accidental rename or swap is caught even at a stable total.
    assert.deepEqual(
      list.result.tools.map(tool => tool.name).sort(),
      [...EXPECTED_TOOL_NAMES].sort(),
    );
    assert.ok(list.result.tools.every(tool => tool.name.startsWith('kettle_')));
    assert.equal(list.result.tools.some(tool => tool.name.startsWith('pentaho_')), false);
    assert.equal(list.result.tools.some(tool => tool.name === 'kettle_set_sql'), false);
    assert.ok(list.result.tools.some(tool => tool.name === 'kettle_set_field'));
    // The four Wave 2 artifact-level tools are present.
    assert.ok(list.result.tools.some(t => t.name === 'kettle_set_parameters'));
    assert.ok(list.result.tools.some(t => t.name === 'kettle_copy_connection'));
    assert.ok(list.result.tools.some(t => t.name === 'kettle_remove_element'));
    assert.ok(list.result.tools.some(t => t.name === 'kettle_edit_error_hop'));
    const addTool = list.result.tools.find(t => t.name === 'kettle_add_element');
    assert.ok(addTool);
    assert.equal(addTool.inputSchema.properties.allowObserved.type, 'boolean');
    assert.ok(list.result.tools.some(t => t.name === 'kettle_create_file'));
    assert.ok(list.result.tools.some(t => t.name === 'kettle_knowledge_analyze_xml'));
    assert.ok(list.result.tools.some(t => t.name === 'kettle_knowledge_coverage'));

    const initialized = responses.find(r => r.id === 1);
    assert.ok(Object.hasOwn(initialized.result.capabilities, 'tools'));
    assert.equal(Object.hasOwn(initialized.result.capabilities, 'prompts'), false);
    assert.equal(Object.hasOwn(initialized.result.capabilities, 'resources'), false);

    const ok = responses.find(r => r.id === 3);
    assert.equal(ok.result.content[0].type, 'text');
    const payload = JSON.parse(ok.result.content[0].text);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.name, 'mini');

    const bad = responses.find(r => r.id === 4);
    assert.equal(bad.result.content[0].type, 'text'); // errors are payloads, not protocol errors
    assert.equal(bad.result.isError, true); // failed tool calls flag isError while keeping readable text
    const badPayload = JSON.parse(bad.result.content[0].text);
    assert.equal(badPayload.ok, false);
    assert.ok(badPayload.error.length > 0);

    const added = responses.find(r => r.id === 5);
    const addedPayload = JSON.parse(added.result.content[0].text);
    assert.equal(addedPayload.ok, true);
    assert.match(addedPayload.data.diff, /^--- /);
    assert.equal(addedPayload.data.catalogStatus, 'observed');
    assert.equal(addedPayload.data.manualReviewRequired, true);

    // Bounded search returns a SearchReport; the tool wraps it as {ok, data}
    // and result.content decodes to data.matches (no bare array anymore).
    const searched = responses.find(r => r.id === 6);
    const searchPayload = JSON.parse(searched.result.content[0].text);
    assert.equal(searchPayload.ok, true);
    assert.ok(Array.isArray(searchPayload.data.matches));
    assert.ok(searchPayload.data.matches.some(h => h.file.endsWith('mini.ktr')));
    assert.equal(searchPayload.data.limit, 100);
    assert.equal(searchPayload.data.truncated, false);
    assert.ok(searchPayload.data.scannedFiles > 0);
    assert.ok(Array.isArray(searchPayload.data.scanIssues));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
