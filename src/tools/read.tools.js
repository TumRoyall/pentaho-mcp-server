/** Read-only tools: inventory, summary, element detail, search. */
import { summarize, getElement } from '../core/summarize.js';
import { listArtifacts, search } from '../core/search.js';

const str = d => ({ type: 'string', description: d });
const PATH = str('Path to a .kjb/.ktr file (absolute, or relative to KETTLE_ROOT)');

export function readTools({ resolve, root }) {
  return [
    {
      name: 'kettle_list',
      description: 'Inventory of Kettle jobs/transformations under a directory (default: KETTLE_ROOT)',
      inputSchema: { type: 'object', properties: { directory: str('Directory to scan') } },
      handler: a => listArtifacts(resolve(a.directory) ?? root),
    },
    {
      name: 'kettle_summary',
      description: 'Summarize one job/transformation: elements with types, hop graph, connections, params, SQL previews',
      inputSchema: { type: 'object', properties: { path: PATH }, required: ['path'] },
      handler: a => summarize(resolve(a.path)),
    },
    {
      name: 'kettle_get_element',
      description: 'Full configuration of one named step/entry, including complete SQL (raw:true adds the raw XML)',
      inputSchema: {
        type: 'object',
        properties: { path: PATH, name: str('Step/entry name'), raw: { type: 'boolean' } },
        required: ['path', 'name'],
      },
      handler: a => getElement(resolve(a.path), a.name, a.raw === true),
    },
    {
      name: 'kettle_search',
      description: 'Search across all .kjb/.ktr files: free text, table (word-boundary), connection, variable, step_type, entry_type',
      inputSchema: {
        type: 'object',
        properties: {
          query: str('What to search for'),
          kind: { type: 'string', enum: ['text', 'table', 'connection', 'variable', 'step_type', 'entry_type'] },
          directory: str('Directory to scan (default: KETTLE_ROOT)'),
        },
        required: ['query'],
      },
      handler: a => search(root, a.query, a.kind ?? 'text', resolve(a.directory)),
    },
  ];
}
