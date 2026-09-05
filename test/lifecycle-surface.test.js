import { test } from 'node:test';
import assert from 'node:assert/strict';

import { listLifecycleResources, readLifecycleResource } from '../src/lifecycle/resources.js';
import { listLifecyclePrompts, getLifecyclePrompt } from '../src/lifecycle/prompts.js';

test('production lifecycle catalog exposes the complete immutable workflow without learning', () => {
  const resources = listLifecycleResources();
  const uris = resources.map(resource => resource.uri);

  assert.ok(uris.includes('dte-pentaho://skills/developing-pentaho-jobs'));
  assert.ok(uris.includes('dte-pentaho://skills/writing-etl-requirements'));
  assert.ok(uris.includes('dte-pentaho://skills/designing-pentaho-solutions'));
  assert.ok(uris.includes('dte-pentaho://skills/generating-pentaho-from-design'));
  assert.ok(uris.includes('dte-pentaho://skills/modifying-pentaho-jobs'));
  assert.ok(uris.every(uri => !/learning|promotion/i.test(uri)));

  const resource = readLifecycleResource('dte-pentaho://skills/developing-pentaho-jobs');
  assert.equal(resource.mimeType, 'text/markdown');
  assert.match(resource.text, /inspect.*workspace/i);
  assert.match(resource.text, /input\/.*read-only/i);
  assert.match(resource.text, /requirement\.md/i);
  assert.match(resource.text, /design\/design\.md/i);
  assert.doesNotMatch(resource.text, /human approval|learning-from-mistakes/i);
  assert.throws(() => readLifecycleResource('dte-pentaho://skills/learning-from-mistakes'), /unknown lifecycle resource/i);
});

test('develop-pentaho-job prompt requires a folder and instructs resumable end-to-end work', () => {
  const prompts = listLifecyclePrompts();
  const prompt = prompts.find(item => item.name === 'develop-pentaho-job');
  assert.ok(prompt);
  assert.deepEqual(prompt.arguments, [{
    name: 'requirementFolder',
    description: 'Existing BA requirement folder, for example REQ_001_LOAD_CUSTOMER',
    required: true,
  }]);

  const result = getLifecyclePrompt('develop-pentaho-job', {
    requirementFolder: 'REQ_001_LOAD_CUSTOMER',
  });
  assert.equal(result.messages[0].role, 'user');
  const text = result.messages[0].content.text;
  assert.match(text, /REQ_001_LOAD_CUSTOMER/);
  assert.match(text, /inspect.*resume/i);
  assert.match(text, /requirement.*design.*Pentaho/is);
  assert.match(text, /ask.*ambigu/i);
  assert.doesNotMatch(text, /approval gate|learning-from-mistakes/i);

  assert.throws(() => getLifecyclePrompt('develop-pentaho-job', {}), /requirementFolder.*required/i);
  assert.throws(() => getLifecyclePrompt('unknown', {}), /unknown lifecycle prompt/i);
});
