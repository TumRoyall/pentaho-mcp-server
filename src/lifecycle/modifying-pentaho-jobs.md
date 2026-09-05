# Modifying Pentaho Jobs

Always read current KJB/KTR bytes and dependency context before editing. Patch the smallest possible XML span; never regenerate an existing manually tuned artifact merely because regeneration is easier. Preserve unknown existing XML, but never add an unknown type.

Validate well-formed XML, names, references, hops, downstream compatibility, secrets, and placeholders after every patch. Changes must be atomic and compare against the hashes observed before editing.

Synchronize the delta back into design YAML and `design/design.md`, then append a reverse-chronological stable `CHG-NNN` entry. Change `requirement.md` only when the business contract changed. A topology or load-strategy change returns to design; an unresolved business change returns to requirement analysis.

Do not edit `input/`, silently broaden scope, deploy, or mutate Git.
