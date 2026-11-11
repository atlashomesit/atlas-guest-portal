/**
 * TASK-1039907 (Meta CAPI consent): the checkout wording for the optional `ads_measurement` purpose.
 *
 * This is a LEGAL text. It is a word-for-word copy of the API's versioned consent text
 * (`GuestConsentConstants.BuildPurposeDisplayText(GuestConsentPurposes.AdsMeasurement, who)`, version
 * `ads_measurement-v1-2026-10`) - the same wording the guest sees on the preferences page when they withdraw it. The API stores
 * that version with the consent, so the words shown here and the version recorded must move together: change this file ONLY when
 * the API's text and version change, and bump ADS_MEASUREMENT_CONSENT_VERSION with them. The pinned test in
 * GuestDetailsPage.adsMeasurementConsent.test.tsx fails if the wording drifts.
 *
 * `who` is the data controller's display name (the same name the other checkout consents use); the API falls back to
 * "the operator of this site" when it is empty, and so does this builder.
 */

export const ADS_MEASUREMENT_CONSENT_VERSION = 'ads_measurement-v1-2026-10';

/** The three fixed runs of the sentence; `who` goes between them (twice). Kept apart so the page can bold the name. */
export const ADS_MEASUREMENT_CONSENT_SEGMENTS = {
  beforeFirstWho: 'I consent to ',
  beforeSecondWho:
    ' sharing a scrambled (hashed) version of my phone number and email address, and the value of my booking, with Meta (Facebook, Instagram, WhatsApp) so that the ads which brought me to ',
  afterSecondWho: ' can be measured. I can withdraw this at any time.',
} as const;

const FALLBACK_WHO = 'the operator of this site';

export function resolveAdsMeasurementWho(dataControllerDisplayName: string | null | undefined): string {
  const who = (dataControllerDisplayName ?? '').trim();
  return who.length > 0 ? who : FALLBACK_WHO;
}

export function buildAdsMeasurementConsentText(dataControllerDisplayName: string | null | undefined): string {
  const who = resolveAdsMeasurementWho(dataControllerDisplayName);
  const s = ADS_MEASUREMENT_CONSENT_SEGMENTS;
  return `${s.beforeFirstWho}${who}${s.beforeSecondWho}${who}${s.afterSecondWho}`;
}
