import { describe, expect, it } from 'vitest';
import { MongoPortalService, mongoPortalIndexes, portalDeliveryConfigured } from './mongo-portal';

describe('Mongo secure portal links', () => {
  it('stores only a token hash and derives the WhatsApp destination from the tenant patient', async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const database = {
      collection(name: string) {
        return {
          async findOne() {
            if (name === 'quotes')
              return { id: 'quote-1', patientId: 'patient-1', status: 'SENT', immutable: true };
            if (name === 'patients')
              return {
                id: 'patient-1',
                phone: '+503 7000-0000',
                notifications: { botmakerConsent: true },
              };
            return null;
          },
          async insertOne(value: Record<string, unknown>) {
            inserted.push(value);
          },
        };
      },
    };
    const result = await new MongoPortalService(database as never).createLink(
      { userId: 'admin-1', organizationId: 'org-1', role: 'ADMIN' },
      { quoteId: 'quote-1' },
      'https://preview.example.test',
    );
    expect(result.portalUrl).toMatch(/^https:\/\/preview\.example\.test\/portal\/[A-Za-z0-9_-]+$/);
    expect(result.whatsappPhone).toBe('50370000000');
    expect(inserted[0]).toHaveProperty('tokenHash');
    expect(JSON.stringify(inserted[0])).not.toContain(result.portalUrl.split('/').at(-1));
  });

  it('defines automatic expiry for portal links', () => {
    expect(mongoPortalIndexes).toContainEqual(
      expect.objectContaining({ name: 'portal_links_expiry_ttl', expireAfterSeconds: 0 }),
    );
  });

  it('does not claim OTP delivery unless every private WhatsApp setting exists', () => {
    expect(portalDeliveryConfigured({ WHATSAPP_ACCESS_TOKEN: 'private' })).toBe(false);
    expect(
      portalDeliveryConfigured({
        WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
        WHATSAPP_ACCESS_TOKEN: 'private',
        WHATSAPP_GRAPH_API_VERSION: 'v23.0',
        WHATSAPP_PORTAL_OTP_TEMPLATE: 'portal_code',
        WHATSAPP_PORTAL_TEMPLATE_LANGUAGE: 'es',
      }),
    ).toBe(true);
  });
});
