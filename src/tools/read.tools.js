/** Read-only tools: inventory, summary, element detail, search. */
import { summarize, getElement } from '../core/summarize.js';
import { listArtifacts, search } from '../core/search.js';

const str = d => ({ type: 'string', description: d });
const PATH = str('Path to a .kjb/.ktr file (workspace-relative, or an absolute path contained by KETTLE_ROOT)');

export function readTools({ resolveRead, root }) {
  return [
    {
      name: 'kettle_list',
      description: 'Inventory of Kettle jobs/transformations under a directory (default: KETTLE_ROOT)',
      inputSchema: { type: 'object', properties: { directory: str('Directory to scan') } },
      handler: a => listArtifacts(resolveRead(a.directory)),
    },
    {
      name: 'kettle_summary',
      description: 'Summarize one job/transformation: elements with types, hop graph, connections, params, SQL previews',
      inputSchema: { type: 'object', properties: { path: PATH }, required: ['path'] },
      handler: a => summarize(resolveRead(a.path)),
    },
    {
      name: 'kettle_get_element',
      description: 'Full configuration of one named step/entry, including complete SQL (raw:true adds the raw XML)',
      inputSchema: {
        type: 'object',
        properties: { path: PATH, name: str('Step/entry name'), raw: { type: 'boolean' } },
        required: ['path', 'name'],
      },
      handler: a => getElement(resolveRead(a.path), a.name, a.raw === true),
    },
    {
      name: 'kettle_search',
      description: 'Search across all .kjb/.ktr files: free text, table (word-boundary), connection, variable, step_type, entry_type',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 1, description: 'What to search for' },
          kind: { type: 'string', enum: ['text', 'table', 'connection', 'variable', 'step_type', 'entry_type'] },
          directory: str('Directory to scan (default: KETTLE_ROOT)'),
          limit: { type: 'integer', minimum: 1, maximum: 500, default: 100, description: 'Maximum matches to return (1..500)' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      handler: a => search(root, a.query, a.kind ?? 'text', resolveRead(a.directory), { limit: a.limit ?? 100 }),
    },
  ];
}
