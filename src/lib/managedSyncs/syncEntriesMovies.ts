import { SyncType, SyncStatus, SyncTrigger } from "../../common/types/db";
import { getSyncRepository, getFilmEntriesRepository, getMoviesRepository } from "../../db/repositories";

export interface SyncEntriesMoviesOptions {
  limit?: number;
}

export async function syncEntriesMovies({ limit = 1000 }: SyncEntriesMoviesOptions = {}) {
  const SyncRepo = await getSyncRepository();
  const { sync } = await SyncRepo.queueSync({ trigger: SyncTrigger.SYSTEM });
  sync.type = SyncType.ENTRIES_MISSING_MOVIES;
  SyncRepo.save(sync);

  const FilmEntriesRepo = await getFilmEntriesRepository();
  const missingMovies = await FilmEntriesRepo.getFilmEntriesWithMissingMovies(limit);

  if (missingMovies.length === 0) {
    return {
      missing: [],
      syncedCount: 0
    };
  }

  const MoviesRepo = await getMoviesRepository();
  const synced = await MoviesRepo.syncMovies(missingMovies);
  if (synced.length > 0) {
    await SyncRepo.endSync(sync, {
      status: SyncStatus.COMPLETE,
      numSynced: synced.length
    });
  } else {
    throw new Error(`Attempted to sync ${missingMovies.length} movies, but 0 were synced. ${JSON.stringify(missingMovies)}`);
  }

  return {
    missing: missingMovies.map(m => m.letterboxdSlug),
    syncedCount: synced.length
  };
}