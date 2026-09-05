# Generating Pentaho from Design

Generate only from a complete validated design package. Treat design YAML as the source of truth for filenames, internal names, components, configuration, fields, SQL, and hop graphs.

Create the declared `.kjb` and `.ktr` files plus required `shared.xml`, `kettle.properties`, launchers, and advisory DDL. Never write real credentials, environment values, or absolute machine paths. XML-escape content and follow the embedded Kettle type catalog and templates. Unknown types stop generation; observed non-generatable types require the matching recorded gap and a manual-review marker.

Validate XML well-formedness, filename/internal-name equality, graph equivalence, connection and file references, secret/placeholder absence, and declaration coverage. Write or update `changelog.md` with an append-only `CHG-NNN` entry. Do not change `input/`, deploy, or mutate Git.
