# Designing Pentaho Solutions

Convert a valid `requirement.md` into `<REQ>/design/design.md`, `manifest.yaml`, job YAML, and transformation YAML. Preserve requirement traceability and never add business behavior not supported by `R-*`, `AC-*`, `SRC-*`, or recorded decisions.

Inspect the affected project dependency closure before choosing topology. Decide ordinary technical matters autonomously using project conventions, failure/restart units, data sharing, and operational ownership. Ask only where evidence conflicts or no safe technical recommendation exists.

Every job entry and transformation step must resolve to the embedded Pentaho catalog. Prefer canonical generator-eligible types. A known non-generatable type must be explicitly recorded as a technical gap; an absent type is `CATALOG_GAP` and blocks generation until verified XML evidence is supplied.

Design YAML is the executable contract: stable IDs, artifact names, parameters, variables, connections, entries/steps, configs, hops, inputs, outputs, error routes, restart behavior, and requirement traceability must be explicit. Render deterministic Mermaid diagrams from YAML and validate graph integrity, references, catalog eligibility, placeholders, secrets, and diagram freshness.

When validation passes, proceed directly to generation. There is no human approval gate.
