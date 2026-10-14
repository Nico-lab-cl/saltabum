// Tipos mínimos del runtime de Cloudflare que usa el sitio (bindings de wrangler.jsonc).
// Se declaran a mano para no cargar @cloudflare/workers-types completo.
declare module "cloudflare:workers" {
  export interface D1Result<T = unknown> {
    results: T[];
    success: boolean;
    meta: Record<string, unknown>;
  }
  export interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    run(): Promise<D1Result>;
    all<T = unknown>(): Promise<D1Result<T>>;
    first<T = unknown>(): Promise<T | null>;
  }
  export interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  }
  export const env: { DB?: D1Database };
}
