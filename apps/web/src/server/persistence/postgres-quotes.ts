import type { Pool } from 'pg';
import { quoteSchema, type Quote } from '@analiza/contracts';
import { canEditQuote } from '@analiza/domain';
import { can } from '@/lib/permissions';
import { MongoAccessError, MongoConflictError, MongoInputError } from '../validation/patients';
import { parseQuoteCreate, parseQuoteReplace } from '../mongo-quotes';
import type { ServerActor } from '../validation/patients';
import type { Persistence } from './contracts';
import { transaction } from './postgres-pool';
import { audit } from './postgres';

function authorize(actor: ServerActor, permission: 'quotes:read' | 'quotes:write') {
  if (!can(actor.role, permission)) throw new MongoAccessError();
}

export function postgresQuotes(pool: Pool): Persistence['quotes'] {
  return {
    async listWithVersions(actor) {
      authorize(actor, 'quotes:read');
      return transaction(pool, actor, async (client) =>
        (
          await client.query(
            'SELECT body,record_version FROM analiza.quotes WHERE organization_id=$1 ORDER BY created_at DESC,id',
            [actor.organizationId],
          )
        ).rows.map((row) => ({
          quote: quoteSchema.parse(row.body),
          version: Number(row.record_version),
        })),
      );
    },

    async get(actor, id) {
      authorize(actor, 'quotes:read');
      return transaction(pool, actor, async (client) => {
        const row = (
          await client.query('SELECT body FROM analiza.quotes WHERE organization_id=$1 AND id=$2', [
            actor.organizationId,
            id,
          ])
        ).rows[0];
        return row ? quoteSchema.parse(row.body) : null;
      });
    },

    async create(actor, input) {
      authorize(actor, 'quotes:write');
      const quote = parseQuoteCreate(input);
      try {
        return await transaction(pool, actor, async (client) => {
          const hospitalization = await client.query(
            'SELECT id FROM analiza.hospitalizations WHERE organization_id=$1 AND id=$2 AND patient_id=$3',
            [actor.organizationId, quote.caseId, quote.patientId],
          );
          if (!hospitalization.rowCount)
            throw new MongoInputError('La hospitalización no está disponible.');

          const rootId = quote.rootQuoteId ?? quote.originalQuoteId ?? quote.id;
          if (quote.version === 1) {
            if (rootId !== quote.id)
              throw new MongoInputError('La primera versión debe ser su raíz.');
          } else {
            const previous = (
              await client.query(
                'SELECT body FROM analiza.quotes WHERE organization_id=$1 AND root_quote_id=$2 ORDER BY quote_version DESC LIMIT 1 FOR UPDATE',
                [actor.organizationId, rootId],
              )
            ).rows[0];
            const previousQuote = previous ? quoteSchema.parse(previous.body) : null;
            if (
              !previousQuote ||
              !previousQuote.immutable ||
              quote.version !== previousQuote.version + 1 ||
              !quote.revisionReason?.trim()
            )
              throw new MongoInputError('La revisión no continúa una versión enviada válida.');
          }

          const stored: Quote = {
            ...quote,
            rootQuoteId: rootId,
            originalQuoteId: rootId,
          };
          await client.query(
            'INSERT INTO analiza.quotes(organization_id,id,case_id,patient_id,root_quote_id,quote_version,body) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',
            [
              actor.organizationId,
              stored.id,
              stored.caseId,
              stored.patientId,
              rootId,
              stored.version,
              JSON.stringify(stored),
            ],
          );
          await audit(
            client,
            actor,
            stored.version > 1 ? 'QUOTE_REVISION_CREATED' : 'QUOTE_CREATED',
            'quote',
            stored.id,
          );
          return quoteSchema.parse(stored);
        });
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
          throw new MongoInputError('La cotización ya existe.');
        throw error;
      }
    },

    async replace(actor, id, input) {
      authorize(actor, 'quotes:write');
      const { quote, expectedVersion } = parseQuoteReplace(input);
      if (quote.id !== id) throw new MongoInputError('El identificador de ruta no coincide.');
      return transaction(pool, actor, async (client) => {
        const current = (
          await client.query(
            'SELECT body FROM analiza.quotes WHERE organization_id=$1 AND id=$2 AND record_version=$3 FOR UPDATE',
            [actor.organizationId, id, expectedVersion],
          )
        ).rows[0];
        if (!current || !canEditQuote(quoteSchema.parse(current.body)))
          throw new MongoConflictError();
        const updated = await client.query(
          "UPDATE analiza.quotes SET body=$4::jsonb,record_version=record_version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 AND record_version=$3 AND body->>'status'='DRAFT' AND (body->>'immutable')::boolean=false RETURNING body",
          [actor.organizationId, id, expectedVersion, JSON.stringify(quote)],
        );
        if (updated.rowCount !== 1) throw new MongoConflictError();
        await audit(client, actor, 'QUOTE_DRAFT_UPDATED', 'quote', id);
        return quoteSchema.parse(updated.rows[0].body);
      });
    },

    async send(actor, id, expectedVersion) {
      authorize(actor, 'quotes:write');
      if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new MongoInputError();
      return transaction(pool, actor, async (client) => {
        const current = (
          await client.query(
            'SELECT body FROM analiza.quotes WHERE organization_id=$1 AND id=$2 AND record_version=$3 FOR UPDATE',
            [actor.organizationId, id, expectedVersion],
          )
        ).rows[0];
        if (!current) throw new MongoConflictError();
        const parsed = quoteSchema.parse(current.body);
        if (!canEditQuote(parsed)) throw new MongoConflictError();
        const sent: Quote = {
          ...parsed,
          status: 'SENT',
          immutable: true,
          sentAt: new Date().toISOString(),
        };
        const updated = await client.query(
          'UPDATE analiza.quotes SET body=$4::jsonb,record_version=record_version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 AND record_version=$3 RETURNING body',
          [actor.organizationId, id, expectedVersion, JSON.stringify(sent)],
        );
        if (updated.rowCount !== 1) throw new MongoConflictError();
        await audit(client, actor, 'QUOTE_SENT_IMMUTABLE', 'quote', id);
        return quoteSchema.parse(updated.rows[0].body);
      });
    },
  };
}
