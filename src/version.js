/**
 * The single source-code version boundary for the MCP server.
 *
 * In source mode (`node src/index.js`, the test suite) the global
 * `__PENTAHO_MCP_VERSION__` is undefined, so SERVER_VERSION falls back to the
 * current package version, "0.1.0". The Windows SEA build replaces the global
 * with the requested release version via an esbuild `define`
 * (see scripts/build-release.mjs), so the packaged executable advertises the
 * real release identity in `serverInfo.version`.
 *
 * The reference is guarded with `typeof` so evaluating this module never throws
 * a ReferenceError when the global is not defined.
 */
export const SERVER_VERSION =
  typeof __PENTAHO_MCP_VERSION__ === 'string' ? __PENTAHO_MCP_VERSION__ : '0.1.0';
