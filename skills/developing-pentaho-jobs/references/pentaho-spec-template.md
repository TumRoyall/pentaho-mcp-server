# Pentaho Implementation Specification

> Fill in every section before implementation. This spec is written for human
> review AND agent execution. It is a plain Markdown contract — not a
> `manifest.yaml`, and it does not require a requirement folder or lifecycle
> state. All artifact paths are **workspace-relative** and end in `.kjb` or
> `.ktr`. Credential values are always **external variables**, never literals.
> Any unresolved decision (marked `TBD`) **blocks implementation** — resolve it
> in design before building. Runtime execution and business-data correctness are
> **not** part of static acceptance.

## Objective and boundaries

- **Business objective:** <what this delivers>
- **Included behavior:** <in-scope processing>
- **Excluded behavior:** <explicitly out of scope>
- **Approved assumptions:** <assumptions the user has approved>

## Artifact inventory

One row per `.kjb`/`.ktr`. All paths are workspace-relative.

| Path | Kind | Internal name | Purpose | Called by |
|---|---|---|---|---|
| `etl/load_customer.ktr` | transformation | load_customer | <one responsibility> | `etl/main.kjb` |
| `etl/main.kjb` | job | main | <orchestration responsibility> | external entrypoint |

## Variables, parameters, and connections

Variables and parameters:

| Name | Type/format | Required/default | Consumers | Value source |
|---|---|---|---|---|
| `BATCH_DATE` | date `yyyy-MM-dd` | required | `main.kjb` | external, non-sensitive |

Connections — credential values are external variables only, never literals:

| Logical name | Technology | Host variable | Port variable | Database variable | User variable | Password variable |
|---|---|---|---|---|---|---|
| `dw` | Oracle | `${DW_HOST}` | `${DW_PORT}` | `${DW_DB}` | `${DW_USER}` | `${DW_PASSWORD}` |

## Job definitions

For each `.kjb`:

Job entries:

| ID | Display name | Pentaho type | Purpose | Component reference | Configuration |
|---|---|---|---|---|---|
| START | START | SPECIAL | required start entry | — | `start=Y` |
| LOAD_CUSTOMER | Load Customer | TRANS | run leaf transformation | `etl/load_customer.ktr` | filename per catalog |

Job hops:

| From | To | Enabled | Condition |
|---|---|---|---|
| START | LOAD_CUSTOMER | Y | unconditional |

- **Failure path:** <where failure routes>
- **Completion path:** <success/completion behavior>

## Transformation definitions

For each `.ktr`:

Transformation steps:

| ID | Display name | Pentaho type | Purpose | Configuration | Input fields | Output fields |
|---|---|---|---|---|---|---|
| GENERATE | Generate rows | RowGenerator | seed rows | `limit=2` | — | <fields> |
| PASS | Pass through | Dummy | pass rows | — | <fields> | <fields> |

Transformation hops:

| From | To | Enabled | Error route |
|---|---|---|---|
| GENERATE | PASS | Y | none |

- **Error-field contract:** <fields carrying error nr/description/fields/codes, or "none">
- **SQL contract:** SQL, when present, is a normal `<sql>` field set via
  `kettle_set_field` with `field: "sql"`. State the SQL text or the SQL contract
  here, or "none".

## Static acceptance criteria

- Every declared artifact exists at its workspace-relative path.
- Internal artifact names match this specification.
- No unresolved `TBD` placeholder and no literal credential remains.
- Every step/entry type has a knowledge-catalog reference.
- Every hop endpoint (from/to) exists.
- Required START / failure / success paths are present where applicable.
- Referenced `.kjb`/`.ktr` paths resolve inside the workspace.
- `kettle_validate` reports zero structural errors for each artifact and for the
  complete target tree.

Business-data correctness and runtime execution are explicitly **not** proven by
these criteria.
