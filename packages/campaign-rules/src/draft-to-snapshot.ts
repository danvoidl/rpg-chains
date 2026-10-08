import {
  CampaignSnapshotSchema,
  SNAPSHOT_SCHEMA_VERSION,
  type CampaignDraft,
  type CampaignSnapshot,
} from '@rpg-chains/shared-types';
import { formatPath, type DraftIssue } from './issues.js';
import {
  publishableChapters,
  toSnapshotChapter,
  toSnapshotClass,
  toSnapshotVillain,
  upcomingChapters,
} from './snapshot-mapping.js';
import { validateDraft } from './validate-draft.js';

export type DraftToSnapshotResult =
  { ok: true; snapshot: CampaignSnapshot } | { ok: false; issues: DraftIssue[] };

/**
 * Serializes the draft into the immutable snapshot of `version` (spec §2.2). Runs the
 * validation gate first; a final `CampaignSnapshotSchema` parse failure also refuses the
 * publish. Chapters under construction enter only by name (`upcomingChapters`).
 */
export function draftToSnapshot(draft: CampaignDraft, version: number): DraftToSnapshotResult {
  const issues = validateDraft(draft);
  if (issues.length > 0) return { ok: false, issues };

  const parsed = CampaignSnapshotSchema.safeParse({
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    campaignId: draft.id,
    version,
    name: draft.name,
    description: draft.description,
    chapters: publishableChapters(draft.chapters).map(toSnapshotChapter),
    upcomingChapters: upcomingChapters(draft.chapters),
    classes: draft.classes.map(toSnapshotClass),
    villains: draft.villains.map(toSnapshotVillain),
    questions: draft.questions,
    items: draft.items,
  });
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        code: 'schema',
        path: formatPath(issue.path),
        message: issue.message,
      })),
    };
  }
  return { ok: true, snapshot: parsed.data };
}
