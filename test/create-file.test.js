import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { XMLValidator } from 'fast-xml-parser';
import { createFile, addElement, editHops } from '../src/core/edit.js';

let tmp;
let prevRoot;

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kettle-create-'));
  prevRoot = process.env.KETTLE_ROOT;
  process.env.KETTLE_ROOT = tmp;
});
afterEach(() => {
  if (prevRoot === undefined) delete process.env.KETTLE_ROOT;
  else process.env.KETTLE_ROOT = prevRoot;
  rmSync(tmp, { recursive: true, force: true });
});

test('createFile makes an empty transformation that validates clean', () => {
  const file = path.join(tmp, 'gen.ktr');
  const res = createFile(file);
  assert.equal(res.kind, 'trans');
  assert.equal(res.name, 'gen'); // defaults to basename
  assert.equal(res.validation.summary.errors, 0);
  const xml = readFileSync(file, 'utf8');
  assert.equal(XMLValidator.validate(xml), true);
  assert.match(xml, /<transformation>[\s\S]*<name>gen<\/name>[\s\S]*<order>[\s\S]*<\/transformation>/);
});

test('createFile makes a job with the single required START entry and validates clean', () => {
  const file = path.join(tmp, 'gen.kjb');
  const res = createFile(file);
  assert.equal(res.kind, 'job');
  // A job with zero or multiple start entries is an error; exactly one passes.
  assert.equal(res.validation.summary.errors, 0);
  const xml = readFileSync(file, 'utf8');
  assert.match(xml, /<type>SPECIAL<\/type>[\s\S]*<start>Y<\/start>/);
  assert.equal((xml.match(/<start>Y<\/start>/g) || []).length, 1);
});

test('createFile uses an explicit name when given', () => {
  const file = path.join(tmp, 'gen.ktr');
  const res = createFile(file, { name: 'etl_trans_demo' });
  assert.equal(res.name, 'etl_trans_demo');
  assert.match(readFileSync(file, 'utf8'), /<name>etl_trans_demo<\/name>/);
});

test('createFile then addElement + editHops builds a working trans from zero', () => {
  const file = path.join(tmp, 'built.ktr');
  createFile(file);
  addElement(file, 'TableInput', 'READ', { x: 100, y: 100 });
  addElement(file, 'Dummy', 'SINK', { x: 300, y: 100 });
  editHops(file, 'add', 'READ', 'SINK');
  const xml = readFileSync(file, 'utf8');
  assert.equal(XMLValidator.validate(xml), true);
  assert.match(xml, /<from>READ<\/from>\s*<to>SINK<\/to>/);
});

test('createFile refuses to overwrite an existing file', () => {
  const file = path.join(tmp, 'gen.ktr');
  writeFileSync(file, '<transformation/>');
  assert.throws(() => createFile(file), /already exists/);
});

test('createFile rejects a non-Kettle extension', () => {
  assert.throws(() => createFile(path.join(tmp, 'notes.txt')), /Not a Kettle file/);
});

test('createFile rejects a kind that conflicts with the extension', () => {
  assert.throws(() => createFile(path.join(tmp, 'gen.ktr'), { kind: 'job' }), /conflicts with extension/);
});

test('createFile enforces the KETTLE_ROOT write boundary', () => {
  const outside = mkdtempSync(path.join(os.tmpdir(), 'kettle-outside-'));
  try {
    assert.throws(() => createFile(path.join(outside, 'y.ktr')), /Refusing to write outside KETTLE_ROOT/);
    assert.equal(existsSync(path.join(outside, 'y.ktr')), false);
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});
