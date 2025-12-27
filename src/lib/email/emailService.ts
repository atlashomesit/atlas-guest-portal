import emailjs from '@emailjs/browser';
import { emailJsConfig, getMissingEmailJsEnvKeys, isEmailJsConfigured } from '@/utils/emailjsConfig';
import { reportError } from '../monitoring';

type EmailPayloadValue = string | number | boolean | null | undefined;

export type EmailPayload = Record<string, EmailPayloadValue>;

interface EmailProvider {
  name: string;
  validateCredentials: () => string[];
  checkConnectivity: () => Promise<boolean>;
  send: (payload: EmailPayload) => Promise<void>;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 500;

const logStructuredError = (error: unknown, provider: string, stage: string, extra?: Record<string, unknown>) => {
  reportError(error, {
    tags: { area: 'email-service', provider, stage },
    ...extra,
  });
};

const attemptWithRetry = async <T>(operation: () => Promise<T>, provider: string, stage: string) => {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < DEFAULT_MAX_ATTEMPTS) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempt += 1;
      logStructuredError(error, provider, stage, { attempt });
      if (attempt >= DEFAULT_MAX_ATTEMPTS) break;
      await delay(DEFAULT_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const emailJsProvider: EmailProvider = {
  name: 'emailjs',
  validateCredentials: () => getMissingEmailJsEnvKeys(),
  checkConnectivity: async () => {
    if (!isEmailJsConfigured()) return false;
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: emailJsConfig.publicKey }),
      });
      return response.ok;
    } catch (error) {
      logStructuredError(error, 'emailjs', 'connectivity-check');
      return false;
    }
  },
  send: async (payload) => {
    const missing = getMissingEmailJsEnvKeys();
    if (missing.length) {
      throw new Error(`Missing EmailJS credentials: ${missing.join(', ')}`);
    }

    await emailjs.send(
      emailJsConfig.serviceId as string,
      emailJsConfig.templateId as string,
      payload,
      { publicKey: emailJsConfig.publicKey as string }
    );
  },
};

const consoleProvider: EmailProvider = {
  name: 'console-fallback',
  validateCredentials: () => [],
  checkConnectivity: async () => true,
  send: async (payload) => {
    console.info('[email fallback] delivering message locally', payload);
  },
};

const providers: EmailProvider[] = [emailJsProvider, consoleProvider];

export const sendEmail = async (payload: EmailPayload) => {
  for (const provider of providers) {
    const missingCredentials = provider.validateCredentials();
    if (missingCredentials.length) {
      logStructuredError(`Missing credentials: ${missingCredentials.join(',')}`, provider.name, 'credential-validation');
      continue;
    }

    const isConnected = await provider.checkConnectivity();
    if (!isConnected) {
      logStructuredError('Provider connectivity check failed', provider.name, 'connectivity-check');
      continue;
    }

    try {
      await attemptWithRetry(() => provider.send(payload), provider.name, 'send');
      return { provider: provider.name };
    } catch (error) {
      logStructuredError(error, provider.name, 'send-final');
    }
  }

  throw new Error('All email providers failed to send the message');
};

export const runEmailHealthCheck = async () => {
  const results = await Promise.all(
    providers.map(async (provider) => {
      const missing = provider.validateCredentials();
      const isConnected = missing.length === 0 ? await provider.checkConnectivity() : false;
      return {
        provider: provider.name,
        healthy: missing.length === 0 && isConnected,
        missingCredentials: missing,
        isConnected,
      };
    })
  );

  const failed = results.filter((result) => !result.healthy);
  if (failed.length) {
    const summary = failed
      .map((item) => `${item.provider}${item.missingCredentials.length ? ` missing: ${item.missingCredentials.join(',')}` : ''}`)
      .join('; ');
    throw new Error(`Email service health check failed: ${summary}`);
  }

  return results;
};
