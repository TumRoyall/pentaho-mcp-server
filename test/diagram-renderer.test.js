import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { renderDesignDiagrams, writeDesignDiagrams } from '../src/lifecycle/diagram-renderer.js';
import { loadDesignPackage } from '../src/lifecycle/design-loader.js';
import { makeDesignFixture } from './fixtures/design-package.js';

test('renderer creates overview, job and transformation Mermaid graphs deterministically', () => {
  const design = makeDesignFixture();
  const pkg = loadDesignPackage(design);
  const first = renderDesignDiagrams(pkg);
  const second = renderDesignDiagrams(pkg);
  assert.equal(first, second);
  assert.match(first, /flowchart LR/);
  assert.match(first, /JOB_001 -->\|LOAD\| TRN_001/);
  assert.match(first, /JOB_001_E01 --> JOB_001_E02/);
  assert.match(first, /IN_01 --> TRN_001_S01/);
  assert.match(first, /TRN_001_S02 --> OUT_01/);
});

test('writer changes only the generated marker region and becomes stable', () => {
  const design = makeDesignFixture();
  const first = writeDesignDiagrams(design);
  assert.equal(first.changed, true);
  assert.match(first.diff, /```mermaid/);
  const content = readFileSync(`${design}/design.md`, 'utf8');
  assert.match(content, /Before diagrams/);
  assert.match(content, /After diagrams/);
  assert.equal(writeDesignDiagrams(design).changed, false);
});
