import "reflect-metadata";
import { DataSource, DataSourceOptions, LoggerOptions } from "typeorm";
import * as entities from "./entities";
import { logger } from "../lib/logger";

type Mutable<T> = { -readonly [P in keyof T ]: T[P] };
type MyDataSourceOptions = Mutable<DataSourceOptions>;

let dataSource: DataSource | null = null;

export interface InitOrmOptions {
  resyncDb?: boolean;
}
export async function initOrm({ resyncDb = process.env.RESYNC_LOX_DB === 'true' }: InitOrmOptions = {}) {
  logger.verbose('POST GRES CONNECTION BEING REINITIALIZED');
  
  const { DATABASE_TYPE } = process.env;
  let dbOptions: MyDataSourceOptions = {} as MyDataSourceOptions;

  if (!DATABASE_TYPE) {
    throw new Error("Invalid database configuration, no database type provided");
  }

  switch (DATABASE_TYPE) {
    case "sqlite":
    case "better-sqlite3":
      dbOptions.type = "sqlite";
      const { DATABASE_PATH } = process.env;
      if (!DATABASE_PATH) {
        throw new Error(`Invalid database configuration, sqlite chosen but no path provided`);
      }
      dbOptions.database = DATABASE_PATH;
      break;
    case "postgres":
      const { DATABASE_URL } = process.env;
      if (!DATABASE_URL) {
        throw new Error(`Invalid database configuration, postgres chosen but url or authentication not provided`);
      }
      dbOptions = {
        type: "postgres",
        url: DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      };
      // if (process.env.DATABASE_MODE && process.env.DATABASE_MODE === "dev") {
      //   console.log("DEV MODE ACTIVATED");
      //   dbOptions.ssl = {
      //     rejectUnauthorized: false
      //   }
      // } else {
      //   dbOptions.ssl = true;
      // }
      if (process.env.DATABASE_HOST) {
        dbOptions.host = process.env.DATABASE_HOST;
      }
      if (process.env.DATABASE_PORT) {
        dbOptions.port = Number(process.env.DATABASE_PORT);
      }
      if (process.env.DATABASE_USERNAME) {
        dbOptions.username = process.env.DATABASE_USERNAME;
      }
      if (process.env.DATABASE_PASSWORD) {
        dbOptions.password = process.env.DATABASE_PASSWORD;
      }
      if (process.env.DATABASE_NAME) {
        dbOptions.database = process.env.DATABASE_NAME;
      }
      if (process.env.DATABASE_SCHEMA) {
        dbOptions.schema = process.env.DATABASE_SCHEMA;
      }
      break;
  }

  const { DB_LOGGING = false } = process.env;

  const logging: LoggerOptions = DB_LOGGING === "all" ? "all" :
    DB_LOGGING === "query" ? ["query", "error"] :
    DB_LOGGING === "error" ? ["error"] : false;

  const ds = new DataSource({
    ...dbOptions,
    entities,
    logging,
    synchronize: resyncDb
  });

  dataSource = await ds.initialize();
}

interface TryDataSourceOptions {
  counter?: number; 
  initializing?: boolean;
}

async function tryDataSource({ counter = 1, initializing = false }: TryDataSourceOptions = {}): Promise<DataSource> {
  if (counter > 10) {
    const message = `getDataSource attempted to initialize database too many times - ${counter} tries`;
    logger.error(message);
    throw new Error(message);
  }

  if (!initializing) {
    await initOrm();
  }

  if (dataSource === null) {
    return await new Promise((resolve) => setTimeout(() => resolve(tryDataSource({ counter: counter + 1, initializing: true })), 10));
  }

  return dataSource;
}

export async function getDataSource(): Promise<DataSource> {
  return tryDataSource();
}