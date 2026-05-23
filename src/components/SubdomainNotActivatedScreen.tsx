/**
 * TASK-2642: shown when a <slug>.atlastays.com subdomain resolves to a real tenant that has NOT
 * bought the WEBSITE add-on. Deliberately BRAND-NEUTRAL — no Atlas logo/favicon, no tenant logo
 * (there is no trusted tenant context here), system font only, no analytics. Renders before any
 * tenant branding is applied so a non-paying tenant's subdomain never leaks Atlas branding.
 */
export default function SubdomainNotActivatedScreen() {
  return (
    <div
      data-testid="subdomain-not-activated"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '24px',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        color: '#1f2937',
        background: '#ffffff',
      }}
    >
      <h1 style={{ fontSize: '22px', fontWeight: 600, margin: 0 }}>This site isn&apos;t set up yet.</h1>
      <p style={{ fontSize: '15px', lineHeight: 1.5, maxWidth: '460px', margin: 0, color: '#4b5563' }}>
        If you own this property, sign in at{' '}
        <a href="https://atlaspms.in" style={{ color: '#2563eb' }}>
          atlaspms.in
        </a>{' '}
        to activate your branded booking site.
      </p>
      <a
        href="https://atlaspms.in/#pricing"
        style={{
          marginTop: '8px',
          display: 'inline-block',
          padding: '10px 20px',
          borderRadius: '8px',
          background: '#2563eb',
          color: '#ffffff',
          fontSize: '15px',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Activate your site
      </a>
    </div>
  );
}
