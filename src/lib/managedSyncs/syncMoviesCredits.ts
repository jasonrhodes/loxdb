import { SyncType, SyncStatus, SyncTrigger } from "../../common/types/db";
import { CastRole, CrewRole, Movie, Sync } from "../../db/entities";
import { getSyncRepository, getMoviesRepository } from "../../db/repositories";
import { addCast, addCrew } from "../addCredits";
import { getErrorAsString } from "../getErrorAsString";
import { tmdb } from "../tmdb";
import { logger as loxDBLogger } from "../../lib/logger";

export async function syncOneMovieCredits(movie: Movie) {
  const syncedCastRoles: CastRole[] = [];
  const syncedCrewRoles: CrewRole[] = [];
  const { cast, crew } = await tmdb.movieCredits(movie.id);
  try {
    loxDBLogger.verbose(`Syncing cast for movie:${movie.id}/${movie.title}`);
    const castRoles = await addCast({ cast, movieId: movie.id });
    castRoles.forEach(c => c ? syncedCastRoles.push(c) : null);
  } catch (error: unknown) {
    loxDBLogger.error(getErrorAsString(error));
  }
  try {
    const crewRoles = await addCrew({ crew, movieId: movie.id });
    crewRoles.forEach(c => c ? syncedCrewRoles.push(c) : null);
  } catch (error) {
    loxDBLogger.error(getErrorAsString(error));
  }

  return { syncedCastRoles, syncedCrewRoles };
}

export interface SyncAllMoviesCreditsOptions {
  limit?: number;
}

export async function syncAllMoviesCredits({ limit = 5000 }: SyncAllMoviesCreditsOptions = {}) {
  const SyncRepo = await getSyncRepository();
  const { sync } = await SyncRepo.queueSync({ trigger: SyncTrigger.SYSTEM });
  sync.type = SyncType.MOVIES_CREDITS;
  SyncRepo.save(sync);
  const MoviesRepo = await getMoviesRepository();
  const moviesWithMissingCredits = await MoviesRepo.getMissingCredits(limit);
  if (moviesWithMissingCredits.length === 0) {
    return { cast: [], crew: [], syncedCount: 0 };
  }

  let allSyncedCastRoles: CastRole[] = [];
  let allSyncedCrewRoles: CrewRole[] = [];

  for (let i = 0; i < moviesWithMissingCredits.length; i++) {
    const movie = moviesWithMissingCredits[i];
    const { syncedCastRoles, syncedCrewRoles } = await syncOneMovieCredits(movie);
    allSyncedCastRoles = allSyncedCastRoles.concat(syncedCastRoles);
    allSyncedCrewRoles = allSyncedCrewRoles.concat(syncedCrewRoles);
    movie.syncedCredits = true;

    try {
      await MoviesRepo.save(movie);
    } catch (error: any) {
      loxDBLogger.debug(JSON.stringify(movie.crew));
      loxDBLogger.error('Save error while trying to update movie wity syncedCredits: true', movie.id, getErrorAsString(error));
      throw error;
    }
  }

  const numSynced = allSyncedCastRoles.length + allSyncedCrewRoles.length;

  if (allSyncedCastRoles.length > 0 || allSyncedCrewRoles.length > 0) {
    await SyncRepo.endSync(sync, {
      status: SyncStatus.COMPLETE,
      numSynced
    });
  } else {
    const message = `Attempted to sync ${moviesWithMissingCredits.length} movies, but 0 credits were synced. ${JSON.stringify(moviesWithMissingCredits)}`;
    loxDBLogger.error(message);
    throw new Error(message);
  }

  return { cast: allSyncedCastRoles, crew: allSyncedCrewRoles, syncedCount: numSynced };
}