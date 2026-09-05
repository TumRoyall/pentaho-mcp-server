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

test('stdio smoke: initialize, tools, prompts, resources, and tool calls', async () => {
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
    rpc(6, 'prompts/list', {}),
    rpc(7, 'prompts/get', { name: 'develop-pentaho-job', arguments: { requirementFolder: 'REQ_001_SMOKE' } }),
    rpc(8, 'resources/list', {}),
    rpc(9, 'resources/read', { uri: 'dte-pentaho://skills/developing-pentaho-jobs' }),
  ].join('\n') + '\n');
  proc.stdin.end();

  try {
    let out = '';
    for await (const chunk of proc.stdout) out += chunk;
    const responses = out.split('\n').filter(l => l.trim().startsWith('{')).map(l => JSON.parse(l));

    const list = responses.find(r => r.id === 2);
    assert.equal(list.result.tools.length, 32); // 19 low-level + 9 lifecycle + 4 runtime
    assert.equal(list.result.tools.filter(t => t.name.startsWith('kettle_')).length, 23);
    assert.equal(list.result.tools.filter(t => t.name.startsWith('pentaho_')).length, 9);
    const addTool = list.result.tools.find(t => t.name === 'kettle_add_element');
    assert.ok(addTool);
    assert.equal(addTool.inputSchema.properties.allowObserved.type, 'boolean');
    assert.ok(list.result.tools.some(t => t.name === 'kettle_create_file'));
    assert.ok(list.result.tools.some(t => t.name === 'kettle_knowledge_analyze_xml'));
    assert.ok(list.result.tools.some(t => t.name === 'kettle_knowledge_coverage'));

    const initialized = responses.find(r => r.id === 1);
    assert.ok(initialized.result.capabilities.tools);
    assert.ok(initialized.result.capabilities.prompts);
    assert.ok(initialized.result.capabilities.resources);

    const prompts = responses.find(r => r.id === 6);
    assert.ok(prompts.result.prompts.some(p => p.name === 'develop-pentaho-job'));
    const prompt = responses.find(r => r.id === 7);
    assert.match(prompt.result.messages[0].content.text, /REQ_001_SMOKE/);

    const resources = responses.find(r => r.id === 8);
    assert.ok(resources.result.resources.some(r => r.uri === 'dte-pentaho://skills/developing-pentaho-jobs'));
    assert.ok(resources.result.resources.every(r => !/learning|promotion/i.test(r.uri)));
    const resource = responses.find(r => r.id === 9);
    assert.match(resource.result.contents[0].text, /inspect.*workspace/i);

    const ok = responses.find(r => r.id === 3);
    assert.equal(ok.result.content[0].type, 'text');
    const payload = JSON.parse(ok.result.content[0].text);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.name, 'mini');

    const bad = responses.find(r => r.id === 4);
    assert.equal(bad.result.content[0].type, 'text'); // errors are payloads, not protocol errors
    const badPayload = JSON.parse(bad.result.content[0].text);
    assert.equal(badPayload.ok, false);
    assert.ok(badPayload.error.length > 0);

    const added = responses.find(r => r.id === 5);
    const addedPayload = JSON.parse(added.result.content[0].text);
    assert.equal(addedPayload.ok, true);
    assert.match(addedPayload.data.diff, /^--- /);
    assert.equal(addedPayload.data.catalogStatus, 'observed');
    assert.equal(addedPayload.data.manualReviewRequired, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
