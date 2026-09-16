import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import {
  feedbackImageTypes,
  feedbackInputSchema,
  feedbackReportSchema,
  MAX_FEEDBACK_IMAGE_BYTES,
  type FeedbackImage,
  type FeedbackReport,
} from '@/lib/feedback';
import { MongoInputError, type ServerActor } from '../validation/patients';
import { transaction } from './postgres-pool';

type FeedbackRow = {
  id: string;
  module: FeedbackReport['module'];
  category: FeedbackReport['category'];
  description: string;
  image_name: string | null;
  image_mime: string | null;
  status: FeedbackReport['status'];
  created_at: Date;
};

function publicReport(row: FeedbackRow): FeedbackReport {
  return feedbackReportSchema.parse({
    id: row.id,
    module: row.module,
    category: row.category,
    description: row.description,
    imageName: row.image_name ?? undefined,
    imageMime: row.image_mime ?? undefined,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  });
}

function validateImage(image: FeedbackImage | undefined) {
  if (!image) return;
  if (
    !image.name.trim() ||
    image.name.length > 255 ||
    image.bytes.byteLength > MAX_FEEDBACK_IMAGE_BYTES ||
    !feedbackImageTypes.includes(image.mimeType as (typeof feedbackImageTypes)[number])
  ) {
    throw new MongoInputError('La imagen adjunta no es válida.');
  }
}

export class PostgresFeedbackRepository {
  constructor(private readonly pool: Pool) {}

  async list(actor: ServerActor): Promise<FeedbackReport[]> {
    return transaction(this.pool, actor, async (client) =>
      (
        await client.query<FeedbackRow>(
          'SELECT id,module,category,description,image_name,image_mime,status,created_at FROM analiza.feedback_reports WHERE organization_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 50',
          [actor.organizationId, actor.userId],
        )
      ).rows.map(publicReport),
    );
  }

  async create(
    actor: ServerActor,
    rawInput: unknown,
    image?: FeedbackImage,
  ): Promise<FeedbackReport> {
    const parsed = feedbackInputSchema.safeParse(rawInput);
    if (!parsed.success) throw new MongoInputError('Revisa los datos del reporte.');
    validateImage(image);
    return transaction(this.pool, actor, async (client) => {
      const id = randomUUID();
      const row = (
        await client.query<FeedbackRow>(
          'INSERT INTO analiza.feedback_reports(organization_id,id,user_id,module,category,description,image_name,image_mime,image_bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,module,category,description,image_name,image_mime,status,created_at',
          [
            actor.organizationId,
            id,
            actor.userId,
            parsed.data.module,
            parsed.data.category,
            parsed.data.description,
            image?.name.trim() ?? null,
            image?.mimeType ?? null,
            image ? Buffer.from(image.bytes) : null,
          ],
        )
      ).rows[0];
      await client.query(
        'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
        [
          actor.organizationId,
          randomUUID(),
          actor.userId,
          'feedback.created',
          'feedback_reports',
          id,
        ],
      );
      return publicReport(row);
    });
  }
}
