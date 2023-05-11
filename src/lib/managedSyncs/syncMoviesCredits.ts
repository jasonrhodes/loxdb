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
  trigger: SyncTrigger;
  limit?: number;
}

export async function syncAllMoviesCredits({ trigger, limit = 5000 }: SyncAllMoviesCreditsOptions) {
  const SyncRepo = await getSyncRepository();

  return await SyncRepo.manageAction<{ cast: CastRole[], crew: CrewRole[] }>({
    trigger,
    type: SyncType.MOVIES_CREDITS,
    action: async () => {
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
      return { cast: allSyncedCastRoles, crew: allSyncedCrewRoles, syncedCount: numSynced };
    }
  });
}