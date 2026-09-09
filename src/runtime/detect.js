import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

function inside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function detectPdi(pentahoHome) {
  if (!pentahoHome) return { available: false, reason: 'PENTAHO_HOME is not configured', kitchen: null, pan: null };
  const requested = path.resolve(pentahoHome);
  if (!existsSync(requested)) throw new Error(`Configured PDI home not found: ${requested}`);
  const home = realpathSync(requested);
  const kitchen = path.resolve(home, 'Kitchen.bat');
  const pan = path.resolve(home, 'Pan.bat');
  if (!inside(home, kitchen) || !inside(home, pan)) throw new Error('PDI executable resolved outside configured home');
  if (!existsSync(kitchen) || !existsSync(pan)) {
    return { available: false, reason: 'Kitchen.bat or Pan.bat is unavailable', home, kitchen, pan };
  }
  // Re-check after canonicalization: a symlink/junction launcher could point
  // outside the canonical PDI home even though its literal path is inside.
  const realKitchen = realpathSync(kitchen);
  const realPan = realpathSync(pan);
  if (!inside(home, realKitchen) || !inside(home, realPan)) {
    throw new Error('PDI executable resolved outside configured home');
  }
  return { available: true, home, kitchen: realKitchen, pan: realPan };
}
