/**
 * Conservative Windows launcher-argument validation.
 *
 * On Windows, Kitchen.bat/Pan.bat can only be spawned through the shell (the
 * Node CVE-2024-27980 guard refuses to spawn .bat directly with shell:false).
 * Once a token reaches cmd.exe, characters like `&`, `|`, `<`, `>`, `^`, `%`,
 * and `!` change command meaning, and CR/LF/NUL can splice in new commands.
 * Rather than attempt exhaustive shell escaping, we reject any token that
 * contains a metacharacter. Ordinary path punctuation — spaces, commas, drive
 * separators, path separators, `=`, dots, dashes, underscores — stays valid so
 * real artifact paths and /param values survive intact.
 */
const UNSAFE = /[\0\r\n"&|<>^%!]/;
const PARAMETER_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export function assertSafeWindowsToken(value, label) {
  const text = String(value ?? '');
  if (UNSAFE.test(text)) {
    throw new Error(`Refusing unsafe Windows shell token in ${label}`);
  }
  return text;
}

export function assertParameterName(name) {
  const text = String(name ?? '');
  if (!PARAMETER_NAME.test(text)) {
    throw new Error(`Invalid parameter name: ${JSON.stringify(name)}`);
  }
  return text;
}
