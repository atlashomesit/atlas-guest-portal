interface ConfigErrorScreenProps {
  message?: string;
}

export function ConfigErrorScreen({ message = "Runtime config missing/invalid" }: ConfigErrorScreenProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        padding: "1.5rem",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "1.125rem", fontWeight: 600, color: "#b91c1c", margin: 0 }}>
        {message}
      </p>
      <p style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.5rem", maxWidth: "28rem" }}>
        Check <code style={{ background: "#f3f4f6", padding: "0.125rem 0.375rem", borderRadius: "0.25rem" }}>/.well-known/atlas-runtime-config.json</code> and ensure it is valid JSON with a valid <code>apiBaseUrl</code>.
      </p>
    </div>
  );
}
