---
name: developing-pentaho-jobs
description: Turn an idea or approved Pentaho requirement into statically validated KJB/KTR artifacts using Superpowers for design/planning and pentaho-mcp-server for knowledge-first XML implementation.
---

# Developing Pentaho Jobs

## Overview

This skill turns a user idea into statically validated Pentaho `.kjb`/`.ktr`
artifacts. Superpowers owns the reasoning (brainstorming, design approval,
specification, planning). The `pentaho-mcp-server` MCP owns the deterministic
domain work: knowledge lookup, XML create/edit, graph operations, and static
validation.

**Core principle:** never invent Pentaho XML. Consult the embedded knowledge
catalog (`kettle_knowledge_get`) before you add or configure any step/entry
type, and let `kettle_validate` define "done" for this workflow.

## Required workflow (in order)

1. Read `references/pentaho-spec-template.md` completely.
2. Invoke `superpowers:brainstorming` to clarify the idea and reach an approved
   design. Do **not** mutate any artifact before design approval.
3. Write a Pentaho implementation specification that fills in **every** section
   of the template, and obtain the user's approval of that written spec.
4. After spec approval, invoke `superpowers:writing-plans` to produce an
   artifact-oriented implementation plan.
5. For **each distinct** entry/step type, call `kettle_knowledge_get(kind, type)`
   before adding or configuring it. Inspect its template, field mapping,
   defaults, and gotchas.
6. If a type is missing, observed-only, or not generator-eligible, **stop** that
   artifact task and report the exact catalog limitation. Do not invent a plugin
   XML layout.
7. Implement leaf `.ktr` files first; implement the orchestration `.kjb` last.
   Build with the retained edit tools: `kettle_create_file`, `kettle_add_element`,
   `kettle_set_field`, `kettle_set_field_path`, `kettle_set_fields`,
   `kettle_edit_hops`, `kettle_add_error_hop`, `kettle_rename_element`,
   `kettle_clone`.
8. Call `kettle_validate` after each changed artifact, and once on the complete
   target directory.
9. Finish with an artifact inventory, validation evidence, any catalog/
   manual-review warnings, and an explicit note of deferred runtime verification.

## Tools this workflow uses

- **Read:** `kettle_list`, `kettle_summary`, `kettle_get_element`, `kettle_search`.
- **Knowledge:** `kettle_knowledge_list`, `kettle_knowledge_get`,
  `kettle_knowledge_analyze_xml` (read-only), `kettle_knowledge_coverage`.
- **Edit:** the nine editors named in step 7.
- **Validate:** `kettle_validate`.

SQL stays a normal `<sql>` field: set it with `kettle_set_field` using
`field: "sql"`.

## Prohibitions

You must not invoke runtime tools in this workflow.
You must not generate testcases in this workflow.
You must not access databases in this workflow.
You must not deploy Pentaho artifacts in this workflow.
You must not mutate Git unless the user explicitly requests it.
You must not write literal credentials.
You must not read from or modify source_old.

You must not use the unregistered BA lifecycle tools of any category —
project inspection, workflow state, requirement/design writing, project
generation, change synchronization, project validation, or finalization. They
are not part of the production surface. Do not call runtime execution,
loadcheck, or runtime-log tools from this workflow either.

## Completion boundary

Static validation is the completion boundary here. `kettle_validate` reporting
zero structural errors for every artifact and for the whole tree — plus a
resolved specification with no placeholders or literal credentials — is what
"done" means. Business-data correctness and runtime execution are deferred and
recorded as follow-up verification, not performed in this workflow.
