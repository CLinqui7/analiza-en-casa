import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { Db } from 'mongodb';
import { can } from '@/lib/permissions';
import {
  MongoAccessError,
  MongoInputError,
  rejectBrowserAuthority,
  type ServerActor,
} from './mongo-patients';

const LINK_TTL_MS = 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const REQUEST_WINDOW_MS = 10 * 60 * 1000;

type PortalLink = {
  id: string;
  organizationId: string;
  quoteId: string;
  patientId: string;
  tokenHash: string;
  deliveryChannel: 'WHATSAPP';
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  verificationCodeHash?: string;
  verificationCodeExpiresAt?: Date;
  verificationCodeUsedAt?: Date;
  failedAttempts: number;
};

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function genericInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MongoInputError();
  return value as Record<string, unknown>;
}

function tokenFrom(input: unknown) {
  const body = genericInput(input);
  if (
    Object.keys(body).some((key) => key !== 'token') ||
    typeof body.token !== 'string' ||
    body.token.length < 32 ||
    body.token.length > 256
  ) {
    throw new MongoInputError('Solicitud no válida.');
  }
  return body.token;
}

function fingerprint(request: Request, tokenHash: string) {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const userAgent = request.headers.get('user-agent') ?? '';
  return {
    ipHash: address ? hash(`${tokenHash}:${address}`) : null,
    userAgentHash: userAgent ? hash(`${tokenHash}:${userAgent}`) : null,
  };
}

async function deliverPortalCode(phone: string, code: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION;
  const templateName = process.env.WHATSAPP_PORTAL_OTP_TEMPLATE;
  const languageCode = process.env.WHATSAPP_PORTAL_TEMPLATE_LANGUAGE;
  if (!portalDeliveryConfigured()) return false;
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }],
        },
      }),
    },
  );
  return response.ok;
}

export function portalDeliveryConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(
    env.WHATSAPP_PHONE_NUMBER_ID &&
    env.WHATSAPP_ACCESS_TOKEN &&
    env.WHATSAPP_GRAPH_API_VERSION &&
    env.WHATSAPP_PORTAL_OTP_TEMPLATE &&
    env.WHATSAPP_PORTAL_TEMPLATE_LANGUAGE,
  );
}

export class MongoPortalService {
  constructor(private readonly database: Db) {}

  async createLink(actor: ServerActor, input: unknown, baseUrl: string, now = new Date()) {
    if (!can(actor.role, 'quotes:write')) throw new MongoAccessError();
    rejectBrowserAuthority(input);
    const body = genericInput(input);
    if (Object.keys(body).some((key) => key !== 'quoteId') || typeof body.quoteId !== 'string')
      throw new MongoInputError();
    const quote = await this.database.collection('quotes').findOne({
      organizationId: actor.organizationId,
      id: body.quoteId,
      status: 'SENT',
      immutable: true,
    });
    if (!quote || typeof quote.patientId !== 'string')
      throw new MongoInputError('Primero envíe una versión inmutable de la cotización.');
    const patient = await this.database
      .collection('patients')
      .findOne({ organizationId: actor.organizationId, id: quote.patientId });
    const phone = typeof patient?.phone === 'string' ? patient.phone.replace(/\D/g, '') : '';
    const consent =
      patient?.notifications &&
      typeof patient.notifications === 'object' &&
      (patient.notifications as { botmakerConsent?: unknown }).botmakerConsent === true;
    if (!phone || !consent)
      throw new MongoInputError(
        'El paciente no tiene teléfono y consentimiento de WhatsApp confirmados.',
      );
    const rawToken = randomBytes(32).toString('base64url');
    const link: PortalLink = {
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      quoteId: body.quoteId,
      patientId: quote.patientId,
      tokenHash: hash(rawToken),
      deliveryChannel: 'WHATSAPP',
      createdAt: now,
      expiresAt: new Date(now.getTime() + LINK_TTL_MS),
      failedAttempts: 0,
    };
    await this.database.collection<PortalLink>('portalLinks').insertOne(link);
    await this.database.collection('auditEvents').insertOne({
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      action: 'PORTAL_LINK_CREATED',
      resourceType: 'portalLink',
      resourceId: link.id,
      occurredAt: now,
    });
    return {
      portalUrl: `${baseUrl.replace(/\/$/, '')}/portal/${rawToken}`,
      whatsappPhone: phone,
      expiresAt: link.expiresAt.toISOString(),
    };
  }

  async requestCode(input: unknown, request: Request, now = new Date()): Promise<void> {
    let rawToken: string;
    try {
      rawToken = tokenFrom(input);
    } catch {
      return;
    }
    const tokenHash = hash(rawToken);
    const link = await this.database.collection<PortalLink>('portalLinks').findOne({ tokenHash });
    if (!link || link.revokedAt || link.expiresAt <= now || link.failedAttempts >= MAX_ATTEMPTS)
      return;
    const marks = fingerprint(request, tokenHash);
    const recent = await this.database.collection('portalAccessLogs').countDocuments({
      portalLinkId: link.id,
      reason: 'OTP_ISSUED',
      occurredAt: { $gt: new Date(now.getTime() - REQUEST_WINDOW_MS) },
    });
    if (recent >= MAX_ATTEMPTS) {
      await this.log(link, false, 'RATE_LIMITED', marks, now);
      return;
    }
    const patient = await this.database
      .collection('patients')
      .findOne({ organizationId: link.organizationId, id: link.patientId });
    const phone = typeof patient?.phone === 'string' ? patient.phone.replace(/\D/g, '') : '';
    if (!phone) return;
    const code = String(randomInt(0, 100_000_000)).padStart(8, '0');
    const issued = await this.database.collection<PortalLink>('portalLinks').updateOne(
      { id: link.id, tokenHash, revokedAt: { $exists: false }, expiresAt: { $gt: now } },
      {
        $set: {
          verificationCodeHash: hash(code),
          verificationCodeExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
        },
        $unset: { verificationCodeUsedAt: '' },
      },
    );
    if (issued.modifiedCount !== 1) return;
    const delivered = await deliverPortalCode(phone, code).catch(() => false);
    if (!delivered) {
      await this.database
        .collection<PortalLink>('portalLinks')
        .updateOne(
          { id: link.id, verificationCodeHash: hash(code) },
          { $unset: { verificationCodeHash: '', verificationCodeExpiresAt: '' } },
        );
      return;
    }
    await this.log(link, false, 'OTP_ISSUED', marks, now);
  }

  async verify(input: unknown, request: Request, now = new Date()) {
    const body = genericInput(input);
    if (
      Object.keys(body).some((key) => key !== 'token' && key !== 'verificationCode') ||
      typeof body.verificationCode !== 'string'
    )
      return null;
    let rawToken: string;
    try {
      rawToken = tokenFrom({ token: body.token });
    } catch {
      return null;
    }
    const tokenHash = hash(rawToken);
    const marks = fingerprint(request, tokenHash);
    const codeHash = hash(body.verificationCode.trim());
    const links = this.database.collection<PortalLink>('portalLinks');
    const verified = await links.findOneAndUpdate(
      {
        tokenHash,
        revokedAt: { $exists: false },
        expiresAt: { $gt: now },
        failedAttempts: { $lt: MAX_ATTEMPTS },
        verificationCodeHash: codeHash,
        verificationCodeExpiresAt: { $gt: now },
        verificationCodeUsedAt: { $exists: false },
      },
      { $set: { verificationCodeUsedAt: now } },
      { returnDocument: 'after' },
    );
    if (!verified) {
      const candidate = await links.findOne({ tokenHash });
      if (candidate) {
        await links.updateOne(
          { id: candidate.id, failedAttempts: { $lt: MAX_ATTEMPTS } },
          { $inc: { failedAttempts: 1 } },
        );
        await this.log(candidate, false, 'INVALID_OR_EXPIRED_CODE', marks, now);
      }
      return null;
    }
    const [quote, insurance] = await Promise.all([
      this.database.collection('quotes').findOne({
        organizationId: verified.organizationId,
        id: verified.quoteId,
        patientId: verified.patientId,
      }),
      this.database.collection('insuranceRequests').findOne({
        organizationId: verified.organizationId,
        quoteId: verified.quoteId,
        patientId: verified.patientId,
      }),
    ]);
    if (!quote) {
      await this.log(verified, false, 'SCOPE_MISMATCH', marks, now);
      return null;
    }
    await this.log(verified, true, 'VERIFIED', marks, now);
    return {
      quote_id: verified.quoteId,
      status: typeof quote.status === 'string' ? quote.status : 'NO_DISPONIBLE',
      insurance_status: typeof insurance?.status === 'string' ? insurance.status : 'SIN_SOLICITUD',
      updated_at:
        insurance?.updatedAt instanceof Date
          ? insurance.updatedAt.toISOString()
          : typeof insurance?.updatedAt === 'string'
            ? insurance.updatedAt
            : typeof quote.updatedAt === 'string'
              ? quote.updatedAt
              : now.toISOString(),
    };
  }

  private async log(
    link: PortalLink,
    success: boolean,
    reason: string,
    marks: { ipHash: string | null; userAgentHash: string | null },
    occurredAt: Date,
  ) {
    await this.database.collection('portalAccessLogs').insertOne({
      id: crypto.randomUUID(),
      organizationId: link.organizationId,
      portalLinkId: link.id,
      success,
      reason,
      ...marks,
      occurredAt,
    });
  }
}

export const mongoPortalIndexes = [
  {
    collection: 'portalLinks',
    key: { tokenHash: 1 },
    name: 'portal_links_token_hash_unique',
    unique: true,
  },
  {
    collection: 'portalLinks',
    key: { expiresAt: 1 },
    name: 'portal_links_expiry_ttl',
    expireAfterSeconds: 0,
  },
  {
    collection: 'portalAccessLogs',
    key: { portalLinkId: 1, occurredAt: -1 },
    name: 'portal_access_link_occurred',
  },
] as const;
