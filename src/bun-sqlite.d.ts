declare module "bun:sqlite" {
  export class Database {
    constructor(filename: string);
    exec(sql: string): void;
    query(sql: string): {
      get<T = unknown>(parameters?: Record<string, unknown>): T;
      all<T = unknown>(parameters?: Record<string, unknown>): T[];
      run(parameters?: Record<string, unknown>): unknown;
    };
    transaction<T>(callback: () => T): () => T;
    close(): void;
  }
}
