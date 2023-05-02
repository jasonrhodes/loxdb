import { TmdbCast } from "../../lib/tmdb";
import { Movie, User, FilmEntry, Collection, Person } from "../../db/entities";
import { CREW_JOB_MAP } from "../constants";

export type UserResponse = Omit<User, "password" | "salt" | "hashUserPassword" | "checkPassword"> & {
  isAdmin?: boolean;
};
export type UserPublicSafe = Omit<UserResponse, "rememberMeToken">;
export type UserPublic = UserResponse | UserPublicSafe;

export type RatedMovie = Movie & Pick<FilmEntry, "stars">;
export type RatedTmdbCast = TmdbCast & { rating?: number };

export type SearchCollection = Pick<Collection, 'id' | 'name'>;

export type OtherStatsType = "collections";
export type PeopleStatsType = "actors" | keyof typeof CREW_JOB_MAP;
export type AllStatsType = OtherStatsType | PeopleStatsType;
export type StatMode = 'favorite' | 'most';
export interface PersonStats extends Person {
  averageRating: number;
  countRated: number;
}

export enum SyncStatus {
  PENDING = "Pending",
  IN_PROGRESS = "In Progress",
  COMPLETE = "Complete",
  SKIPPED = "Skipped",
  FAILED = "Failed"
}

export enum SyncType {
  UNKNOWN = "Unknown",
  NONE = "None",
  USER_RATINGS = "User:Ratings",
  USER_LISTS = "User:Lists",
  RATINGS_MOVIES = "Ratings:Movies",
  ENTRIES_MISSING_MOVIES = "Entries:Missing_Movies",
  MOVIES_CAST = "Movies:Cast",
  MOVIES_CREW = "Movies:Crew",
  MOVIES_CREDITS = "Movies:Credits",
  MOVIES_COLLECTIONS = "Movies:Collections",
  POPULAR_MOVIES_YEAR = "Popular_Movies:By_Year",
  POPULAR_MOVIES_GENRE = "Popular_Movies:By_Genre",
  POPULAR_MOVIES_MOVIES = "Popular_Movies:Movies",
  DEPRECATED_MOVIES = "Movies"
}

export enum SyncTrigger {
  SYSTEM = "system",
  USER = "user"
}

export type TypeOrmEntityMethods = 'hasId' | 'remove' | 'save' | 'softRemove' | 'recover' | 'reload';