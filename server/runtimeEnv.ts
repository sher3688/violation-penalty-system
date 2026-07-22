export type HyperdriveBinding = {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
};

export type R2ObjectBody = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
};

export type R2Binding = {
  put(key: string, value: ArrayBuffer | Uint8Array | ReadableStream, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
};

export type WorkerRuntimeEnv = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  HYPERDRIVE?: HyperdriveBinding;
  CASE_PHOTOS?: R2Binding;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  LOCAL_AUTH_SECRET?: string;
  ADMIN_RECOVERY_USERNAME?: string;
  ADMIN_RECOVERY_PASSWORD?: string;
  PUBLIC_ACCESS?: string;
  BACKUP_SYNC_URL?: string;
  BACKUP_SYNC_SECRET?: string;
  NODE_ENV?: string;
};

let runtimeEnv: WorkerRuntimeEnv | null = null;

export function setRuntimeEnv(env: WorkerRuntimeEnv) {
  runtimeEnv = env;
}

export function getRuntimeEnv() {
  return runtimeEnv;
}

/**
 * Temporary public management mode.
 *
 * This release intentionally defaults to enabled so the deployed site opens
 * without a login screen. Setting PUBLIC_ACCESS=false restores the normal
 * cookie-based login flow without removing any accounts or passwords.
 */
export function isPublicAccessEnabled() {
  const value = runtimeEnv?.PUBLIC_ACCESS ?? process.env.PUBLIC_ACCESS;
  return value?.trim().toLowerCase() !== "false";
}
