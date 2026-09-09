/**
 * Artifact-level edit tools: replace the parameter list and copy a named
 * connection between artifacts. Both go through the shared workspace boundary
 * (resolveRead/resolveWrite) and return a unified diff of exactly what changed.
 */
import { setArtifactParameters, copyConnection } from '../core/artifact-edit.js';

const str = d => ({ type: 'string', description: d });
const PATH = str('Path to a .kjb/.ktr file (workspace-relative, or an absolute path contained by KETTLE_ROOT)');

export function artifactTools({ resolveRead, resolveWrite }) {
  return [
    {
      name: 'kettle_set_parameters',
      description: 'Replace the artifact-level parameter list. Transformation parameters live under transformation/info/parameters; job parameters live under job/parameters. Each parameter renders <name>, <default_value>, <description> in that stable order. Duplicate or blank names are rejected. Creates the <parameters> container when absent. Returns a unified diff.',
      inputSchema: {
        type: 'object',
        properties: {
          path: PATH,
          parameters: {
            type: 'array',
            description: 'Full replacement parameter list (order preserved).',
            items: {
              type: 'object',
              properties: {
                name: str('Parameter name (must be non-blank and unique)'),
                default: str('Default value (optional)'),
                description: str('Description (optional)'),
              },
              required: ['name'],
              additionalProperties: false,
            },
          },
        },
        required: ['path', 'parameters'],
      },
      handler: a => ({ diff: setArtifactParameters(resolveWrite(a.path), a.parameters) }),
    },
    {
      name: 'kettle_copy_connection',
      description: 'Copy one named top-level <connection> block from an in-root source artifact into a destination artifact. Refuses a destination-name collision. Source and destination kind are independent (a job connection may be copied into a transformation and vice versa). Rejects a source connection whose password is non-placeholder (plaintext); an encrypted password requires allowEncryptedPassword:true. Placeholder passwords (empty or ${VARIABLE}) are always allowed. Returns the destination diff.',
      inputSchema: {
        type: 'object',
        properties: {
          sourcePath: str('Source .kjb/.ktr containing the connection (workspace-relative, or an absolute in-root path)'),
          destPath: str('Destination .kjb/.ktr to receive the connection (workspace-relative, or an absolute in-root path)'),
          sourceName: str('Name of the connection to copy from the source'),
          destName: str('Optional new name for the connection in the destination (defaults to sourceName)'),
          allowEncryptedPassword: {
            type: 'boolean',
            description: 'Opt in to copying a connection whose password is a Pentaho "Encrypted ..." string',
          },
        },
        required: ['sourcePath', 'destPath', 'sourceName'],
      },
      handler: a => ({
        diff: copyConnection(resolveRead(a.sourcePath), resolveWrite(a.destPath), a.sourceName, {
          destName: a.destName,
          allowEncryptedPassword: a.allowEncryptedPassword === true,
        }),
      }),
    },
  ];
}
