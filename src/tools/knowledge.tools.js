/**
 * Knowledge tools. Expose the embedded PDI knowledge base so the agent can ask
 * "which types do you know?" and "how is this type built?" without shipping the
 * knowledge folder separately.
 */
import { listTypes, getReference, isGeneratorEligible, verifiedVersions, knowledgeDir } from '../knowledge/loader.js';
import { analyzeKnowledgeXml } from '../core/knowledge-intake.js';
import { knowledgeCoverage } from '../core/knowledge-coverage.js';

const str = d => ({ type: 'string', description: d });
const KIND = { type: 'string', enum: ['job', 'trans'], description: 'job (entries) or trans (steps)' };
const VERIFICATION = {
  type: 'string',
  enum: ['unverified', 'spoon_loaded', 'runtime_passed'],
  description: 'How the supplied XML was verified; defaults to unverified',
};

export function knowledgeTools({ resolveRead, root } = {}) {
  return [
    {
      name: 'kettle_knowledge_list',
      title: 'List knowledge types',
      description: 'List the step/entry types documented in the embedded knowledge catalog, with status (canonical/observed) and generator eligibility',
      annotations: { title: 'List knowledge types', readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: { kind: KIND },
        additionalProperties: false,
      },
      handler: a => {
        const kinds = a.kind ? [a.kind] : ['job', 'trans'];
        const out = { knowledgeDir: knowledgeDir() };
        for (const k of kinds) {
          out[k] = listTypes(k).map(e => ({
            type: e.type,
            xml_type: e.xml_type,
            status: e.status,
            generator_eligible: isGeneratorEligible(k, e.xml_type),
            source_version: e.source_version ?? null,
            verified_versions: verifiedVersions(e),
            verification: e.verification ?? null,
            file: e.file,
          }));
        }
        return out;
      },
    },
    {
      name: 'kettle_knowledge_get',
      title: 'Get knowledge reference',
      description: 'Get the full knowledge reference for one type (XML template, config field table, YAML->XML mapping, gotchas). Accepts the Kettle XML type (e.g. TableInput, SPECIAL) or the design alias (e.g. TABLE_INPUT).',
      annotations: { title: 'Get knowledge reference', readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: { kind: KIND, type: str('Type name (xml_type or design alias)') },
        required: ['kind', 'type'],
        additionalProperties: false,
      },
      handler: a => {
        const ref = getReference(a.kind, a.type);
        return {
          kind: a.kind,
          requested: a.type,
          entry: ref.entry,
          generator_eligible: isGeneratorEligible(a.kind, ref.entry.xml_type),
          source_version: ref.entry.source_version ?? null,
          verified_versions: verifiedVersions(ref.entry),
          verification: ref.entry.verification ?? null,
          file: ref.file,
          content: ref.content,
        };
      },
    },
    {
      name: 'kettle_knowledge_analyze_xml',
      title: 'Analyze knowledge XML',
      description: 'Analyze user-supplied Kettle XML as a read-only catalog candidate; never writes knowledge or promotes a type',
      annotations: { title: 'Analyze knowledge XML', readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          kind: KIND,
          xml: str('Complete .kjb/.ktr XML or one complete <entry>/<step> block'),
          elementName: str('Component name when a complete artifact has multiple candidates'),
          sourceArtifact: str('Optional repository-relative provenance path'),
          pdiVersion: str('Exact PDI version from which the XML was obtained'),
          plugin: str('Plugin name and version, when applicable'),
          verification: VERIFICATION,
        },
        required: ['kind', 'xml'],
        additionalProperties: false,
      },
      handler: a => analyzeKnowledgeXml(a),
    },
    {
      name: 'kettle_knowledge_coverage',
      title: 'Knowledge coverage report',
      description: 'Report canonical, observed, and missing step/entry type usage under KETTLE_ROOT',
      annotations: { title: 'Knowledge coverage report', readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          directory: str('Directory under KETTLE_ROOT to scan'),
          includeExamples: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      handler: a => knowledgeCoverage(resolveRead ? resolveRead(a.directory) : root, {
        includeExamples: a.includeExamples !== false,
      }),
    },
  ];
}
