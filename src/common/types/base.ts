import { Movie } from "../../db/entities";

export type LetterboxdAccountLevel = 'basic' | 'pro' | 'patron';
export type PartialMovie = Partial<Movie> & { id: number; };

export type ListSortBy = 'publishDate' | 'lastUpdated' | 'title';
export type ListScope = 'user-owned' | 'user-following' | 'all';

export type LOG_LEVEL = "error" | "warning" | "info" | "verbose" | "debug";
// export type Logger = (level: LOG_LEVEL, ...messages: string[]) => void;

export type LogMessage = string | number | null | undefined;

export abstract class Logger {
  abstract log(level: LOG_LEVEL, ...messages: LogMessage[]): void;
  abstract error(...messages: LogMessage[]): void;
  abstract warning(...messages: LogMessage[]): void;
  abstract info(...messages: LogMessage[]): void;
  abstract verbose(...messages: LogMessage[]): void;
  abstract debug(...messages: LogMessage[]): void;
}