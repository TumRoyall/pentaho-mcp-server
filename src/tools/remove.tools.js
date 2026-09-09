/** Reference-safe removal tools. Each returns a unified diff of what changed. */
import { removeElement, editErrorHop } from '../core/remove.js';

const str = d => ({ type: 'string', description: d });
const PATH = str('Path to a .kjb/.ktr file (workspace-relative, or an absolute path contained by KETTLE_ROOT)');

export function removeTools({ resolveWrite }) {
  return [
    {
      name: 'kettle_remove_element',
      title: 'Remove element',
      description: 'Remove a named step (trans) or entry (job). By default refuses when any hop, error-hop, or known step-reference tag still points to the element, listing the reference kinds. With removeReferences:true it removes those hops/error blocks, blanks matching step-reference tag contents (keeping the tags), and removes the element atomically. Removing the sole job START entry is always rejected. Returns diff.',
      annotations: { title: 'Remove element', readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          path: PATH,
          name: str('Step/entry name to remove'),
          removeReferences: {
            type: 'boolean',
            description: 'Cascade: also remove referencing hops/error blocks and blank step-reference tags (default false)',
          },
        },
        required: ['path', 'name'],
        additionalProperties: false,
      },
      handler: a => ({
        diff: removeElement(resolveWrite(a.path), a.name, { removeReferences: a.removeReferences === true }),
      }),
    },
    {
      name: 'kettle_edit_error_hop',
      title: 'Edit error hop',
      description: 'Enable, disable, or remove the transformation error block whose source step matches. enable/disable set <is_enabled>. remove drops the <error> block and also removes the ordinary source->target hop only when no other explicit route still needs it. Transformations only; jobs are rejected. Returns diff.',
      annotations: { title: 'Edit error hop', readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          path: PATH,
          action: { type: 'string', enum: ['enable', 'disable', 'remove'], description: 'Operation to perform on the error block' },
          source: str('Source step whose error block is edited'),
        },
        required: ['path', 'action', 'source'],
        additionalProperties: false,
      },
      handler: a => ({ diff: editErrorHop(resolveWrite(a.path), a.action, a.source) }),
    },
  ];
}
