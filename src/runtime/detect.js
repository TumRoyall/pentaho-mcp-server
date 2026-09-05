import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

function inside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function detectPdi(config) {
  if (!config.pentahoHome) return { available: false, reason: 'pentaho.home is not configured', kitchen: null, pan: null };
  const requested = path.resolve(config.pentahoHome);
  if (!existsSync(requested)) throw new Error(`Configured PDI home not found: ${requested}`);
  const home = realpathSync(requested);
  const kitchen = path.resolve(home, 'Kitchen.bat');
  const pan = path.resolve(home, 'Pan.bat');
  if (!inside(home, kitchen) || !inside(home, pan)) throw new Error('PDI executable resolved outside configured home');
  if (!existsSync(kitchen) || !existsSync(pan)) {
    return { available: false, reason: 'Kitchen.bat or Pan.bat is unavailable', home, kitchen, pan };
  }
  return { available: true, home, kitchen, pan };
}
