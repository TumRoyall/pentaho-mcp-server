/** Surgical edit tools. Each returns a unified diff of exactly what changed. */
import {
  createFile, addElement, setField, setFields, setFieldPath, editHops, addErrorHop, renameElement, cloneFile,
} from '../core/edit.js';

const str = d => ({ type: 'string', description: d });
const PATH = str('Path to a .kjb/.ktr file (workspace-relative, or an absolute path contained by KETTLE_ROOT)');

export function editTools({ resolveRead, resolveWrite }) {
  return [
    {
      name: 'kettle_create_file',
      description: 'Create a brand-new empty Kettle file from scratch (no source to clone). Kind is inferred from the extension: .ktr yields an empty transformation (empty <order>), .kjb yields a job with the single required START entry and an empty <hops>. The internal artifact name defaults to the filename basename. Refuses to overwrite an existing file. Returns the validation report for the new file.',
      inputSchema: {
        type: 'object',
        properties: {
          path: str('Destination .kjb/.ktr path (workspace-relative, or an absolute path contained by KETTLE_ROOT). Must not exist.'),
          kind: { type: 'string', enum: ['job', 'trans'], description: 'Optional; must match the extension if given' },
          name: str('Optional internal artifact name; defaults to the filename without extension'),
        },
        required: ['path'],
      },
      handler: a => createFile(resolveWrite(a.path), { kind: a.kind, name: a.name }),
    },
    {
      name: 'kettle_add_element',
      description: 'Add a new step (trans) or entry (job) to a file, using the XML template from the knowledge base for the given type. Sets the element name. Returns diff, catalogStatus, and manualReviewRequired.',
      inputSchema: {
        type: 'object',
        properties: {
          path: PATH,
          type: str('Kettle XML type, e.g. "ExcelOutput", "TableInput", "SQL"'),
          name: str('Name for the new step/entry'),
          x: { type: 'number', description: 'Optional GUI x location' },
          y: { type: 'number', description: 'Optional GUI y location' },
          allowObserved: {
            type: 'boolean',
            description: 'Allow an observed/ineligible catalog type and add a MANUAL_REVIEW marker',
          },
        },
        required: ['path', 'type', 'name'],
      },
      handler: a => addElement(resolveWrite(a.path), a.type, a.name, {
        x: a.x,
        y: a.y,
        allowObserved: a.allowObserved === true,
      }),
    },
    {
      name: 'kettle_set_field',
      description: 'Set one child element value on a named step/entry; creates the child if absent (returns diff)',
      inputSchema: {
        type: 'object',
        properties: { path: PATH, name: str('Step/entry name'), field: str('Child element tag'), value: str('New value') },
        required: ['path', 'name', 'field', 'value'],
      },
      handler: a => ({ diff: setField(resolveWrite(a.path), a.name, a.field, a.value) }),
    },
    {
      name: 'kettle_set_field_path',
      description: 'Set one value nested under a step/entry, addressed by a slash path of tag names (e.g. "file/sheetname"). Ancestors must exist; the leaf is created if absent. Returns diff.',
      inputSchema: {
        type: 'object',
        properties: {
          path: PATH,
          name: str('Step/entry name'),
          fieldPath: str('Slash path of nested tag names, e.g. "file/sheetname"'),
          value: str('New value'),
        },
        required: ['path', 'name', 'fieldPath', 'value'],
      },
      handler: a => ({ diff: setFieldPath(resolveWrite(a.path), a.name, a.fieldPath, a.value) }),
    },
    {
      name: 'kettle_set_fields',
      description: 'Fill a repeatable list of item blocks inside a step/entry (e.g. SelectValues <field>/<meta>, ExcelWriter <fields>). Learns each item\'s child tag order and defaults from the FIRST existing item in the template, then rebuilds the whole run from the given items. Omitted tags fall back to the template default. If the list has no existing item of that type, the child-tag order is derived from the keys of the given items and a new run is inserted before the list\'s closing tag (seeds a brand-new item type, e.g. SelectValues <meta>). Returns diff.',
      inputSchema: {
        type: 'object',
        properties: {
          path: PATH,
          name: str('Step/entry name'),
          listTag: str('Wrapping list tag, e.g. "fields"'),
          itemTag: str('Repeatable item tag inside the list, e.g. "field" or "meta"'),
          items: {
            type: 'array',
            description: 'One object per item; keys are child tag names, values are their text.',
            items: { type: 'object', additionalProperties: { type: 'string' } },
          },
        },
        required: ['path', 'name', 'listTag', 'itemTag', 'items'],
      },
      handler: a => ({ diff: setFields(resolveWrite(a.path), a.name, a.listTag, a.itemTag, a.items) }),
    },
    {
      name: 'kettle_edit_hops',
      description: 'Add, remove, enable, or disable a hop between two named elements (returns diff). Job hops carry semantics: success (evaluation=Y, the default), failure (evaluation=N — the red hop), or unconditional (unconditional=Y). A hop added from the START entry defaults to unconditional=Y automatically, matching Spoon. Transformation hops have no evaluation/unconditional; for a transformation error ("red") hop use kettle_add_error_hop instead.',
      inputSchema: {
        type: 'object',
        properties: {
          path: PATH,
          action: { type: 'string', enum: ['add', 'remove', 'enable', 'disable'] },
          from: str('Source element name'),
          to: str('Target element name'),
          evaluation: { type: 'string', enum: ['Y', 'N'], description: 'Job hops: follow on success (Y) or failure (N)' },
          unconditional: { type: 'string', enum: ['Y', 'N'], description: 'Job hops: always follow (auto-Y from START)' },
        },
        required: ['path', 'action', 'from', 'to'],
      },
      handler: a => ({
        diff: editHops(resolveWrite(a.path), a.action, a.from, a.to, {
          evaluation: a.evaluation, unconditional: a.unconditional,
        }),
      }),
    },
    {
      name: 'kettle_add_error_hop',
      description: 'Add transformation error handling: route the error rows of a source step into a target step (the red "error hop" in Spoon). Writes both the <error> block inside the transformation-level <step_error_handling> container AND an ordinary enabled hop source -> target, in one atomic edit. Transformations only. Refuses if the source step already has an error hop. Optional value fields (nr/description/fields/codes) and limits (max_errors, max_pct_errors, min_pct_rows) default empty and can be set afterwards with kettle_set_field_path on the source step.',
      inputSchema: {
        type: 'object',
        properties: {
          path: PATH,
          source: str('Step whose error rows are routed out'),
          target: str('Step that receives the error rows'),
          enabled: { type: 'boolean', description: 'Is error handling enabled? Default true' },
          nrErrorsField: str('Field name to hold the number of errors (optional)'),
          errorDescField: str('Field name to hold error description(s) (optional)'),
          errorFieldsField: str('Field name to hold the fields in error (optional)'),
          errorCodesField: str('Field name to hold error code(s) (optional)'),
          maxErrors: str('Max errors before a hard stop (optional)'),
          maxPctErrors: str('Max percent errors before a hard stop (optional)'),
          minPctRows: str('Min rows read before percent evaluation (optional)'),
        },
        required: ['path', 'source', 'target'],
      },
      handler: a => ({
        diff: addErrorHop(resolveWrite(a.path), a.source, a.target, {
          enabled: a.enabled,
          nrErrorsField: a.nrErrorsField,
          errorDescField: a.errorDescField,
          errorFieldsField: a.errorFieldsField,
          errorCodesField: a.errorCodesField,
          maxErrors: a.maxErrors,
          maxPctErrors: a.maxPctErrors,
          minPctRows: a.minPctRows,
        }),
      }),
    },
    {
      name: 'kettle_rename_element',
      description: 'Rename a step/entry and update every hop that references it (returns diff)',
      inputSchema: {
        type: 'object',
        properties: { path: PATH, oldName: str('Current name'), newName: str('New name') },
        required: ['path', 'oldName', 'newName'],
      },
      handler: a => ({ diff: renameElement(resolveWrite(a.path), a.oldName, a.newName) }),
    },
    {
      name: 'kettle_clone',
      description: 'Copy an existing .kjb/.ktr as a template: sets the internal name and applies literal find/replace substitutions',
      inputSchema: {
        type: 'object',
        properties: {
          sourcePath: PATH,
          destPath: str('Destination path (must not exist)'),
          name: str('Internal name for the new artifact'),
          replacements: {
            type: 'array',
            items: {
              type: 'object',
              properties: { find: str('Literal text to find'), replace: str('Replacement text') },
              required: ['find', 'replace'],
            },
          },
        },
        required: ['sourcePath', 'destPath', 'name'],
      },
      handler: a => cloneFile(resolveRead(a.sourcePath), resolveWrite(a.destPath), a.name, a.replacements ?? []),
    },
  ];
}
