const prompt = Object.freeze({
  name: 'develop-pentaho-job',
  description: 'Develop or resume a complete Pentaho request from an existing BA requirement folder.',
  arguments: Object.freeze([Object.freeze({
    name: 'requirementFolder',
    description: 'Existing BA requirement folder, for example REQ_001_LOAD_CUSTOMER',
    required: true,
  })]),
});

export function listLifecyclePrompts() {
  return [prompt];
}

export function getLifecyclePrompt(name, args = {}) {
  if (name !== prompt.name) throw new Error(`Unknown lifecycle prompt: ${name}`);
  const requirementFolder = args.requirementFolder?.trim();
  if (!requirementFolder) throw new Error('requirementFolder is required');

  return {
    description: prompt.description,
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: [
          `Develop or resume the Pentaho workflow for ${requirementFolder}.`,
          'First inspect the project manifest and current workspace artifacts, then resume or patch the earliest stale stage.',
          'Read every Markdown file in input/ as read-only evidence. Produce and keep synchronized requirement.md, design/design.md, design YAML, Pentaho KJB/KTR artifacts, and changelog.md.',
          'Use the packaged lifecycle resources and high-level lifecycle tools. Validate each stage before advancing.',
          'Do not invent business facts. Ask the user only about genuine unresolved business ambiguity, conflicting evidence, or an irreversible replacement decision.',
          'Make ordinary technical design choices autonomously. Do not mutate Git unless the user explicitly requests it.',
        ].join('\n'),
      },
    }],
  };
}
