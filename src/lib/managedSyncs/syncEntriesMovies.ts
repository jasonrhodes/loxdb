import { SyncType, SyncStatus, SyncTrigger } from "../../common/types/db";
import { getSyncRepository, getFilmEntriesRepository, getMoviesRepository } from "../../db/repositories";

export interface SyncEntriesMoviesOptions {
  trigger: SyncTrigger;
  limit?: number;
}

export async function syncEntriesMovies({ trigger, limit = 1000 }: SyncEntriesMoviesOptions) {
  const SyncRepo = await getSyncRepository();

  return await SyncRepo.manageAction<{ missing: (string | undefined)[] }>({
    trigger,
    type: SyncType.ENTRIES_MISSING_MOVIES,
    action: async () => {
      const FilmEntriesRepo = await getFilmEntriesRepository();
      const missingMovies = await FilmEntriesRepo.getFilmEntriesWithMissingMovies(limit);

      if (missingMovies.length === 0) {
        return { missing: [], syncedCount: 0 };
      }

      const MoviesRepo = await getMoviesRepository();
      const synced = await MoviesRepo.syncMovies(missingMovies);

      return {
        missing: missingMovies.map(m => m.letterboxdSlug),
        syncedCount: synced.length
      };
    }
  });
}