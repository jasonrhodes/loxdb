/**
 * This file has been commented out so I can remove the dependency
 * on better-sqlite3, which causes lots of issues in Lambda/Docker
 * world due to it needing node-gyp, python, make, etc.
 * 
 * If I need this again, I will need to add better-sqlite3 back as
 * a dependency to this library, which will in turn add it back to
 * both the betterlox-app and to the nova script lib.
 */

// import { DBClient, DBStatement, SqliteAdapterConfig } from "./types";
// import Database, { Statement } from "better-sqlite3";

// export function getClient(config: SqliteAdapterConfig) {
//   return new SqliteClient(config);
// }

// class SqliteClient implements DBClient {
//   db: InstanceType<typeof Database>;

//   constructor(config: SqliteAdapterConfig) {
//     this.db = new Database(config.path);
//   }

//   prepare<V extends any[], R = unknown>(query: string) {
//     const stmt = this.db.prepare<V>(query);
//     return new SqliteStatement<V, R>(stmt);
//   }
// }

// class SqliteStatement<V extends any[], R = unknown> implements DBStatement<V, R> {
//   stmt: Statement<V>;

//   constructor(stmt: Statement<V>) {
//     this.stmt = stmt;
//   }

//   async run(...values: V) {
//     return this.stmt.run(...values);
//   }

//   async all(...values: V) {
//     return this.stmt.all(...values) as R[];
//   }

//   async get(...values: V) {
//     return this.stmt.get(...values) as R | undefined;
//   }
// }