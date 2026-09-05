# DDL Generation From Design

Shared reference for generating Oracle DDL scripts from a Pentaho Design Package. Used by both
`generating-pentaho-from-design` (new projects) and `modifying-pentaho-jobs` (change requests that
add new tables).

## When to generate DDL

Generate a DDL script for every output object in the design that satisfies **any** of these:

1. The design declares it as a new table (no pre-existing DDL or production evidence).
2. The manifest `dependencies[]` lists it under `type: deployment-prerequisite`.
3. A change request adds a new target table or a new staging/control table.

Do **not** generate DDL for:
- Source tables owned by upstream systems (e.g. ODS tables you only read).
- Tables that already exist and are not being structurally modified by this change.

## Output location

```text
dte-etl-pentaho/<project_path>/ddl/
├── <SCHEMA>.<TABLE_NAME>.sql          # One file per new table
└── ddl_advisory.md                    # Index and partition recommendations
```

For modifications that add tables to an existing project, place DDL in the same `ddl/` directory
of the project.

## DDL generation rules

### Column type mapping (YAML target_type to Oracle DDL)

The design YAML `outputs[].fields[].target_type` already contains the Oracle type declaration.
Transcribe it directly:

| YAML target_type | Oracle DDL column clause |
|---|---|
| `VARCHAR2(n)` | `VARCHAR2(n)` |
| `NUMBER` | `NUMBER` |
| `NUMBER(p)` | `NUMBER(p)` |
| `NUMBER(p,s)` | `NUMBER(p,s)` |
| `DATE` | `DATE` |
| `TIMESTAMP` | `TIMESTAMP` |
| `CLOB` | `CLOB` |
| `BLOB` | `BLOB` |

If `target_type` is absent, fall back to the generic type mapping:

| YAML type | Oracle DDL |
|---|---|
| `String` (no size) | `VARCHAR2(4000)` |
| `Number` (no precision) | `NUMBER` |
| `Date` | `DATE` |
| `Integer` | `NUMBER(38,0)` |
| `Boolean` | `NUMBER(1,0)` |
| `BigNumber` | `NUMBER` |
| `Timestamp` | `TIMESTAMP` |

### Nullability

- If `nullable: true` or nullable is absent: no NOT NULL constraint (Oracle default).
- If `nullable: false`: add `NOT NULL`.

### Primary key and constraints

- If `key_fields` is non-empty in the output definition: create a PRIMARY KEY constraint on those
  columns, named `PK_<TABLE_NAME>`.
- If `key_fields` is empty or `key_note` says there is no key: do not create a PK.
- Never invent a key that the design does not declare.

### Table and column naming

- Use the exact `target_schema` and `target_object` from the design YAML.
- Use the exact `name` from each field entry.
- Column order follows the order declared in `outputs[].fields[]`.

### DDL template

```sql
-- Generated from design: <design_id> version <design_version>
-- Transformation: <transformation_id> output: <output_id>
-- Load strategy: <load_outcome summary>

CREATE TABLE <SCHEMA>.<TABLE_NAME>
(
    <COLUMN_1>    <TYPE>    <NULL_CONSTRAINT>,
    <COLUMN_2>    <TYPE>    <NULL_CONSTRAINT>,
    ...
    <COLUMN_N>    <TYPE>    <NULL_CONSTRAINT>
    [, CONSTRAINT PK_<TABLE_NAME> PRIMARY KEY (<key_col_1>, <key_col_2>, ...)]
);
```

## Index advisory

Index recommendations are **optional suggestions**, not prescriptions. Present them in
`ddl_advisory.md` with reasoning so the DBA or developer can accept, modify, or reject.

### When to suggest an index

| Signal in design | Suggested index type | Reasoning |
|---|---|---|
| Column appears in WHERE/filter predicate of a downstream step's SQL | B-tree index | Speeds up filtering for subsequent reads |
| Column is used in JOIN condition by a downstream transformation | B-tree index | Speeds up join lookup |
| Load strategy is `delete-period-append` with a date column in the DELETE predicate | B-tree index on the date column | DELETE performance per period |
| Table has a declared business key but no PK | Unique index on key columns | Data integrity |
| Column has low cardinality and is used in analytical queries | Consider bitmap index | Only for read-heavy, rarely-modified tables |
| Table is target of frequent full-table-scan reads by downstream steps | Generally no index needed | Truncate-and-load tables rebuild indexes anyway |

### When NOT to suggest an index

- Tables with `truncate-and-load` strategy and no downstream queries in the same ETL flow:
  indexes slow down bulk load and get rebuilt anyway.
- Columns that are never referenced in any WHERE, JOIN, or ORDER BY in the design.
- Do not suggest indexes based on speculation about future queries not present in the design.

### Index naming convention

```
IDX_<TABLE_NAME>_<COLUMN_1>[_<COLUMN_2>...]
```

Truncate to 30 characters if needed (Oracle object name limit for older versions).

## Partition advisory

Partition recommendations are **optional suggestions**. Present them in `ddl_advisory.md`.

### When to suggest partitioning

| Signal in design | Suggested partition strategy | Reasoning |
|---|---|---|
| Load strategy is `delete-period-append` by a date column | RANGE partition on that date column (monthly or daily intervals depending on volume) | DELETE and INSERT operate on a single partition, avoiding full-table lock |
| Requirement mentions retention/purge policy on a date column | RANGE partition on that column | Enables DROP PARTITION for fast purge |
| Volume estimate exceeds ~10M rows and queries filter by a specific column | RANGE or LIST on filter column | Partition pruning improves query performance |
| Table is `truncate-and-load` with low volume | Do NOT partition | Truncate is already fast; partitioning adds complexity for no benefit |

### When NOT to suggest partitioning

- Small tables (estimated < 1M rows) with truncate-and-load strategy.
- Tables with no date-based or category-based access pattern.
- When the design has no volume estimate and no retention policy: state that partitioning
  cannot be recommended without volume data, rather than guessing.

### Partition clause template (RANGE by date)

```sql
PARTITION BY RANGE (<DATE_COLUMN>)
INTERVAL (NUMTOYMINTERVAL(1, 'MONTH'))
(
    PARTITION P_INIT VALUES LESS THAN (TO_DATE('2026-01-01', 'YYYY-MM-DD'))
);
```

Adjust the initial partition boundary and interval based on:
- The `PRD_ID` or date column granularity in the design.
- Any retention window from the requirement.

## Advisory document template (ddl_advisory.md)

```markdown
# DDL Advisory — <project_name>

Generated from: <design_id> version <design_version>

## Tables requiring DDL

| # | Schema.Table | Fields | Load strategy | DDL file |
|---|---|---|---|---|
| 1 | ... | ... | ... | ... |

## Index recommendations

| Table | Suggested index | Columns | Type | Reasoning |
|---|---|---|---|---|
| ... | ... | ... | B-tree | ... |

## Partition recommendations

| Table | Suggested strategy | Column | Interval | Reasoning |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

## Notes

- These recommendations are advisory. DBA review is expected before execution.
- Index and partition decisions should account for production volume which may differ from
  design-time estimates.
```

## Constraints on the generator

1. **Never invent columns.** Only columns present in the design YAML `outputs[].fields[]` appear
   in the DDL.
2. **Never invent keys.** If the design says no key, the DDL has no PK.
3. **Never invent indexes on speculation.** Every index suggestion traces to a specific SQL
   predicate or load pattern in the design.
4. **Never set tablespace, storage, or physical attributes** unless the design or a project
   convention explicitly provides them. Leave physical storage to DBA discretion.
5. **Advisory is not prescription.** The `ddl_advisory.md` uses "recommend" and "suggest"
   language. The DDL `.sql` files contain only the CREATE TABLE — indexes and partitions go in the
   advisory document as separate CREATE INDEX / ALTER TABLE statements for the DBA to apply or
   adapt.
