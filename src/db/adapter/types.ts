/**
 * This file has been commented out so I can remove the dependency
 * on better-sqlite3, which causes lots of issues in Lambda/Docker
 * world due to it needing node-gyp, python, make, etc.
 * 
 * If I need this again, I will need to add better-sqlite3 back as
 * a dependency to this library, which will in turn add it back to
 * both the betterlox-app and to the nova script lib.
 */

// import Database from "better-sqlite3";

// export type AdapterType = 'sqlite' | 'postgresql';
// export type SqliteDatabaseInstance = InstanceType<typeof Database>;
// export type DBInstance = SqliteDatabaseInstance;

// export interface SqliteAdapterConfig {
//   path: string;
// }

// export interface PostGresQLAdapterConfig {

// }

// export type AdapterConfig = SqliteAdapterConfig | PostGresQLAdapterConfig;

// interface DBRunResult {
//   changes: number;
//   lastInsertRowid: number | bigint;
// }

// export interface DBStatement<V extends any[], R = unknown> {
//   run: (...values: V) => Promise<DBRunResult>,
//   all: (...values: V) => Promise<R[]>,
//   get: (...values: V) => Promise<R | undefined>
// }

// export interface DBClient {
//   prepare: <V extends any[], R = unknown>(query: string) => DBStatement<V, R>
// }