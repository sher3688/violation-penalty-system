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
  NODE_ENV?: string;
};

let runtimeEnv: WorkerRuntimeEnv | null = null;

export function setRuntimeEnv(env: WorkerRuntimeEnv) {
  runtimeEnv = env;
}

export function getRuntimeEnv() {
  return runtimeEnv;
}
