import { getEmailHealthSnapshot, sendEmailCanary } from "../../../src/lib/email/emailService";
import { reportError } from "../../../src/lib/monitoring";

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const deriveStatus = (providers: Awaited<ReturnType<typeof getEmailHealthSnapshot>>) => {
  const healthyCount = providers.filter((provider) => provider.healthy).length;
  if (healthyCount === providers.length) return "operational" as const;
  if (healthyCount > 0) return "degraded" as const;
  return "down" as const;
};

export const onRequestGet = async ({ request }: { request: Request }) => {
  const { searchParams } = new URL(request.url);
  const triggerCanary = searchParams.get("canary") === "true";

  try {
    const providers = await getEmailHealthSnapshot();
    const status = deriveStatus(providers);

    if (status !== "operational") {
      reportError(new Error(`Email health is ${status}`), {
        level: status === "down" ? "error" : "warning",
        tags: { area: "email-health" },
        providers,
      });
    }

    let canary: "skipped" | "sent" | "failed" = "skipped";

    if (triggerCanary) {
      try {
        await sendEmailCanary();
        canary = "sent";
      } catch (error) {
        canary = "failed";
        reportError(error, { tags: { area: "email-health", stage: "canary" } });
      }
    }

    const statusCode = status === "down" || canary === "failed" ? 503 : 200;

    return jsonResponse({
      status,
      providers,
      canary,
      timestamp: new Date().toISOString(),
    }, statusCode);
  } catch (error) {
    reportError(error, { tags: { area: "email-health", stage: "handler" } });
    return jsonResponse(
      {
        status: "down",
        error: error instanceof Error ? error.message : String(error),
      },
      503,
    );
  }
};
