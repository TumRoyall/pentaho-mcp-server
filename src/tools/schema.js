/**
 * Server-side argument validation for MCP tool calls.
 *
 * Client-side JSON Schema validation is not assumed, so the server validates
 * every call against the tool's declared `inputSchema` before invoking the
 * handler. This is a deliberately small subset of JSON Schema — exactly the
 * shapes the project's tool schemas use — kept in one focused module so no
 * runtime schema dependency is required:
 *
 *   - object   : required fields, additionalProperties (false or a value schema)
 *   - enum     : membership
 *   - scalars  : string / number / integer / boolean
 *   - string   : minLength / maxLength
 *   - number   : minimum / maximum (integer also enforces integrality)
 *   - array    : items schema
 *
 * On failure it returns a single deterministic, path-qualified message such as
 * `Invalid arguments for kettle_search: $.limit must be an integer between 1 and 500`.
 * On success it returns null.
 */

/** JSON-path style label for a nested location, rooted at `$`. */
function joinPath(parent, key) {
  return `${parent}.${key}`;
}

function typeName(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Validate `value` against `schema` at `path`. Returns an error string
 * (without the tool prefix) on the first failure, or null when valid.
 * Depth-first, properties visited in declaration order, so messages are stable.
 */
function validateValue(schema, value, path) {
  if (!schema || typeof schema !== 'object') return null;

  const { type } = schema;

  // Enum membership is checked before type so `kind: 'bogus'` yields the
  // enum message rather than a generic type message.
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      return `${path} must be one of: ${schema.enum.join(', ')}`;
    }
  }

  switch (type) {
    case 'string': {
      if (typeof value !== 'string') return `${path} must be a string`;
      if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
        return schema.minLength === 1
          ? `${path} must be a non-empty string`
          : `${path} must be a string of at least ${schema.minLength} characters`;
      }
      if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
        return `${path} must be a string of at most ${schema.maxLength} characters`;
      }
      return null;
    }
    case 'integer':
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return `${path} must be ${type === 'integer' ? 'an integer' : 'a number'}`;
      }
      if (type === 'integer' && !Number.isInteger(value)) {
        return rangeMessage(schema, path, 'an integer');
      }
      const hasMin = typeof schema.minimum === 'number';
      const hasMax = typeof schema.maximum === 'number';
      if ((hasMin && value < schema.minimum) || (hasMax && value > schema.maximum)) {
        return rangeMessage(schema, path, type === 'integer' ? 'an integer' : 'a number');
      }
      return null;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') return `${path} must be a boolean`;
      return null;
    }
    case 'array': {
      if (!Array.isArray(value)) return `${path} must be an array`;
      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          const err = validateValue(schema.items, value[i], `${path}[${i}]`);
          if (err) return err;
        }
      }
      return null;
    }
    case 'object': {
      return validateObject(schema, value, path);
    }
    default:
      // No declared type (or an unsupported one): accept as-is.
      return null;
  }
}

function rangeMessage(schema, path, noun) {
  const hasMin = typeof schema.minimum === 'number';
  const hasMax = typeof schema.maximum === 'number';
  if (hasMin && hasMax) return `${path} must be ${noun} between ${schema.minimum} and ${schema.maximum}`;
  if (hasMin) return `${path} must be ${noun} >= ${schema.minimum}`;
  if (hasMax) return `${path} must be ${noun} <= ${schema.maximum}`;
  return `${path} must be ${noun}`;
}

function validateObject(schema, value, path) {
  if (typeName(value) !== 'object') return `${path} must be an object`;
  const properties = schema.properties ?? {};

  for (const name of schema.required ?? []) {
    if (!Object.prototype.hasOwnProperty.call(value, name) || value[name] === undefined) {
      return `${joinPath(path, name)} is required`;
    }
  }

  const additional = schema.additionalProperties;
  // A schema object (not `false`) means "open value-map": validate each value
  // against it. This is how the runtime `parameters` string-map stays open
  // while still enforcing that every value is a string.
  const additionalSchema = additional && typeof additional === 'object' ? additional : null;

  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    if (Object.prototype.hasOwnProperty.call(properties, key)) {
      const err = validateValue(properties[key], entry, joinPath(path, key));
      if (err) return err;
    } else if (additionalSchema) {
      const err = validateValue(additionalSchema, entry, joinPath(path, key));
      if (err) return err;
    } else if (additional === false) {
      return `${joinPath(path, key)} is not an allowed property`;
    }
  }
  return null;
}

/**
 * Validate `args` against `tool.inputSchema`. Returns a deterministic,
 * path-qualified error string prefixed with the tool name, or null when the
 * arguments satisfy the schema.
 */
export function validateToolArguments(tool, args) {
  const schema = tool?.inputSchema;
  if (!schema || schema.type !== 'object') return null;
  const err = validateObject(schema, args ?? {}, '$');
  return err ? `Invalid arguments for ${tool.name}: ${err}` : null;
}
