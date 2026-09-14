import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Hospitalization } from '@analiza/contracts';
import { AdministrativeProfilePanel } from './administrative-profile-panel';

const hospitalization: Hospitalization = {
  id: 'hosp-ch08-profile',
  patientId: 'patient-ch08-profile',
  startDate: '2026-08-28',
  status: 'ACTIVE',
  accountType: 'PRIVATE',
};

describe('CH08 administrative profile integration boundary', () => {
  // test-id: vitest:ch08-supabase-profile-ui-block
  it('shows the secure integration notice and no profile save entry point in Supabase mode', () => {
    const onOpen = vi.fn();
    const markup = renderToStaticMarkup(
      createElement(AdministrativeProfilePanel, {
        hospitalization,
        canWrite: true,
        onOpen,
        providerMode: 'supabase',
      }),
    );

    expect(markup).toContain('administrative-profile-integration-blocked');
    expect(markup).not.toContain('HOSPITALIZATION-ADMIN-PROFILE-OPEN');
    expect(markup).not.toContain('Guardar cambios');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('keeps the editable profile entry point available only in mock mode', () => {
    const markup = renderToStaticMarkup(
      createElement(AdministrativeProfilePanel, {
        hospitalization,
        canWrite: true,
        onOpen: vi.fn(),
        providerMode: 'mock',
      }),
    );

    expect(markup).toContain('HOSPITALIZATION-ADMIN-PROFILE-OPEN');
    expect(markup).not.toContain('administrative-profile-integration-blocked');
  });
});
