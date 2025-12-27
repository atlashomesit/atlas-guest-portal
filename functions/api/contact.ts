import { sendEmail } from "../../src/lib/email/emailService";
import { emailJsConfig } from "../../src/utils/emailjsConfig";
import { reportError } from "../../src/lib/monitoring";

type ContactRequest = {
  name?: string;
  email?: string;
  contactnumber?: string;
  destination?: string;
  description?: string;
};

type Env = {
  CONTACT_FAILED_EMAILS?: {
    put: (key: string, value: string) => Promise<unknown>;
  };
};

type ErrorResponse = {
  success: false;
  code: string;
  message: string;
  queued?: boolean;
};

type SuccessResponse = {
  success: true;
  provider: string;
  queued?: boolean;
};

const jsonResponse = (body: SuccessResponse | ErrorResponse, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

const queueFailedAttempt = async (env: Env, payload: ContactRequest, error: unknown) => {
  if (!env.CONTACT_FAILED_EMAILS || typeof env.CONTACT_FAILED_EMAILS.put !== "function") {
    console.warn("[contact-api] queue storage unavailable", { payload, error });
    return false;
  }

  const id = `contact-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}`;
  const queuedPayload = {
    payload,
    error: error instanceof Error ? error.message : String(error),
    createdAt: new Date().toISOString(),
  };

  try {
    await env.CONTACT_FAILED_EMAILS.put(id, JSON.stringify(queuedPayload));
    return true;
  } catch (queueError) {
    console.error("[contact-api] failed to queue contact request", queueError);
    return false;
  }
};

const validatePayload = (body: ContactRequest) => {
  const requiredFields: (keyof Required<ContactRequest>)[] = [
    "name",
    "email",
    "contactnumber",
    "destination",
    "description",
  ];

  for (const field of requiredFields) {
    const value = body[field];
    if (!value || typeof value !== "string" || !value.trim()) {
      return field;
    }
  }

  return null;
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  let body: ContactRequest;
  try {
    body = (await request.json()) as ContactRequest;
  } catch (error) {
    return jsonResponse(
      { success: false, code: "invalid_json", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const missingField = validatePayload(body);
  if (missingField) {
    return jsonResponse(
      { success: false, code: "missing_field", message: `Missing required field: ${missingField}.` },
      { status: 400 },
    );
  }

  const payload = {
    user_name: body.name,
    user_email: body.email,
    user_contactnumber: body.contactnumber,
    destination: body.destination,
    message: body.description,
    to_email: emailJsConfig.ownerEmail,
  };

  try {
    const result = await sendEmail(payload);

    if (result.simulated) {
      reportError(new Error("Email delivery simulated via console fallback"), {
        level: "warning",
        provider: result.provider,
        providerHealth: result.providerHealth,
        tags: { area: "contact-api" },
      });
    }

    return jsonResponse({ success: true, provider: result.provider, queued: result.simulated });
  } catch (error) {
    const queued = await queueFailedAttempt(env, body, error);

    return jsonResponse(
      {
        success: false,
        code: "delivery_failed",
        message: "We could not deliver your message right now. Please try again or use phone/WhatsApp.",
        queued,
      },
      { status: 502 },
    );
  }
};
