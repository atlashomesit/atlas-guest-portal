import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  OfflineGuidebookDownloadButton,
  buildPrintableGuidebookHtml,
} from './OfflineGuidebookDownloadButton';

describe('GUEST-100 OfflineGuidebookDownloadButton', () => {
  it('builds escaped printable offline guidebook HTML with Wi-Fi, PIN, and rules', () => {
    const html = buildPrintableGuidebookHtml({
      propertyName: 'Goa Palms <Villa>',
      bookingCode: 'ATL-9021',
      checkInDate: '2026-12-01',
      checkOutDate: '2026-12-04',
      wifiNetwork: 'GoaPalms_5G',
      wifiPassword: 'sunshine42',
      doorPin: '7741',
      houseRules: ['No smoking indoors'],
    });
    expect(html).toContain('Goa Palms &lt;Villa&gt;');
    expect(html).toContain('GoaPalms_5G');
    expect(html).toContain('7741');
    expect(html).toContain('No smoking indoors');
  });

  it('triggers download callback on click', () => {
    const onDownload = vi.fn();
    render(
      <OfflineGuidebookDownloadButton
        guidebook={{
          propertyName: 'Goa Palms',
          bookingCode: 'ATL-9021',
          checkInDate: '2026-12-01',
          checkOutDate: '2026-12-04',
        }}
        onDownload={onDownload}
      />
    );
    fireEvent.click(screen.getByTestId('download-offline-guidebook-btn'));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });
});
