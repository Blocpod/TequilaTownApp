/**
 * Runtime configuration, read once from environment variables.
 *
 * Secrets (JWT_SECRET, QR_SIGNING_SECRET) fall back to fixed development values
 * when running locally, with a loud warning. On any deployed Netlify context they
 * are mandatory: endpoints that need them answer 500 NOT_CONFIGURED instead of
 * silently using a guessable secret.
 */
import { DEV_QR_SECRET } from './codes';
import { ApiError } from './http';

export { DEV_QR_SECRET };

export const DEV_JWT_SECRET = 'tt-dev-only-jwt-secret-do-not-use-in-production-0001';

export const DEFAULT_MODELS = {
  chat: 'anthropic/claude-sonnet-5.5',
  vision: 'anthropic/claude-sonnet-5.5',
  image: 'google/gemini-3.1-flash-image',
} as const;

export type Config = {
  /** true on any deployed Netlify context (production, deploy previews, branch deploys). */
  deployed: boolean;
  /** running under `netlify dev` (enables the dev-proxy retry shim in app.ts). */
  netlifyDev: boolean;
  jwtSecret: string | null;
  jwtSecretIsDev: boolean;
  qrSecret: string | null;
  qrSecretIsDev: boolean;
  openrouterKey: string | null;
  openrouterBaseUrl: string | null;
  models: { chat: string; vision: string; image: string };
  resendKey: string | null;
  resetEmailFrom: string | null;
  appleBundleIds: string[];
  appleSignIn: boolean;
  adminKey: string | null;
  /** Canonical public origin, e.g. https://tequilatown.com (falls back to the request origin). */
  publicBaseUrl: string | null;
  /** App store links used on the web share pages. */
  appStoreUrl: string | null;
  playStoreUrl: string | null;
  /** scrypt cost parameter (N). Lowered in tests only. */
  scryptN: number;
};

type Env = Record<string, string | undefined>;

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export function isDeployed(env: Env): boolean {
  if (env.NETLIFY_DEV === 'true') return false;
  return Boolean(env.CONTEXT === 'production' || env.NETLIFY || env.AWS_LAMBDA_FUNCTION_NAME || env.DEPLOY_ID || env.SITE_ID);
}

let warned = false;

export function loadConfig(env: Env = process.env): Config {
  const deployed = isDeployed(env);
  const jwt = clean(env.JWT_SECRET);
  const qr = clean(env.QR_SIGNING_SECRET);
  if (!deployed && (!jwt || !qr) && !warned && env.VITEST !== 'true') {
    warned = true;
    console.warn(
      '[tequila-town] WARNING: JWT_SECRET and/or QR_SIGNING_SECRET are not set — using fixed DEVELOPMENT secrets. ' +
        'Never deploy without setting both.',
    );
  }
  const base = clean(env.PUBLIC_BASE_URL);
  return {
    deployed,
    netlifyDev: env.NETLIFY_DEV === 'true',
    jwtSecret: jwt ?? (deployed ? null : DEV_JWT_SECRET),
    jwtSecretIsDev: !jwt,
    qrSecret: qr ?? (deployed ? null : DEV_QR_SECRET),
    qrSecretIsDev: !qr,
    openrouterKey: clean(env.OPENROUTER_API_KEY),
    openrouterBaseUrl: clean(env.OPENROUTER_BASE_URL),
    models: {
      chat: clean(env.OPENROUTER_CHAT_MODEL) ?? DEFAULT_MODELS.chat,
      vision: clean(env.OPENROUTER_VISION_MODEL) ?? DEFAULT_MODELS.vision,
      image: clean(env.OPENROUTER_IMAGE_MODEL) ?? DEFAULT_MODELS.image,
    },
    resendKey: clean(env.RESEND_API_KEY),
    resetEmailFrom: clean(env.RESET_EMAIL_FROM),
    appleBundleIds: (clean(env.APPLE_BUNDLE_IDS) ?? 'com.tequilatown.app')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    appleSignIn: env.APPLE_SIGN_IN_ENABLED !== 'false',
    adminKey: clean(env.ADMIN_API_KEY),
    publicBaseUrl: base ? base.replace(/\/+$/, '') : null,
    appStoreUrl: clean(env.APP_STORE_URL),
    playStoreUrl: clean(env.PLAY_STORE_URL),
    scryptN: Number(env.SCRYPT_N) > 0 ? Number(env.SCRYPT_N) : 2 ** 17,
  };
}

export function requireJwtSecret(cfg: Config): string {
  if (!cfg.jwtSecret) throw new ApiError('NOT_CONFIGURED', 'Server authentication is not configured', { status: 500 });
  return cfg.jwtSecret;
}

export function requireQrSecret(cfg: Config): string {
  if (!cfg.qrSecret) throw new ApiError('NOT_CONFIGURED', 'QR code verification is not configured', { status: 500 });
  return cfg.qrSecret;
}

export const passwordResetEnabled = (cfg: Config) => Boolean(cfg.resendKey && cfg.resetEmailFrom);
