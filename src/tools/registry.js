/**
 * Tool registry. Each tool module exports a factory that takes shared context
 * ({ resolve, root }) and returns an array of tool objects
 * ({ name, description, inputSchema, handler }). buildTools() flattens them.
 *
 * Adding a feature: write a new `*.tools.js` factory and add it to FACTORIES.
 * No other file changes. server.js discovers everything through buildTools().
 */
import { readTools } from './read.tools.js';
import { editTools } from './edit.tools.js';
import { validateTools } from './validate.tools.js';
import { knowledgeTools } from './knowledge.tools.js';
import { lifecycleTools } from './lifecycle.tools.js';
import { runtimeTools } from './runtime.tools.js';

const FACTORIES = [readTools, editTools, validateTools, knowledgeTools, lifecycleTools, runtimeTools];

export function buildTools(ctx) {
  const tools = FACTORIES.flatMap(factory => factory(ctx));
  const seen = new Set();
  for (const t of tools) {
    if (seen.has(t.name)) throw new Error(`Duplicate tool name: ${t.name}`);
    seen.add(t.name);
  }
  return tools;
}
