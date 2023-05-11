import { SyncStatus, SyncTrigger, SyncType } from "../../common/types/db";
import { getMoviesRepository, getPopularLetterboxdMoviesRepository, getSyncRepository } from "../../db/repositories";
import { logger as loxDBlogger } from "../../lib/logger";

interface Options {
  trigger: SyncTrigger;
  limit?: number;
}

export async function syncPopularMoviesMovies({ trigger, limit = 5000 }: Options) {
  const SyncRepo = await getSyncRepository();

  return await SyncRepo.manageAction<{ missing: (string | undefined)[] }>({
    trigger,
    type: SyncType.POPULAR_MOVIES_MOVIES,
    action: async () => {
      const PopularMoviesRepo = await getPopularLetterboxdMoviesRepository();
      const missingMovies = await PopularMoviesRepo.getPopularMoviesWithMissingMovies(limit);

      if (missingMovies.length === 0) {
        return {
          syncedCount: 0,
          missing: []
        };
      }
      
      const MoviesRepo = await getMoviesRepository();
      const synced = await MoviesRepo.syncMovies(missingMovies);
      if (synced.length === 0) {
        const message = `Attempted to sync ${missingMovies.length} movies, but 0 were synced.\n${JSON.stringify(missingMovies)}`;
        loxDBlogger.error(message);
        throw new Error(message);
      }
      
      return {
        syncedCount: synced.length,
        missing: missingMovies.map(m => m.letterboxdSlug)
      };

    }
  });
}