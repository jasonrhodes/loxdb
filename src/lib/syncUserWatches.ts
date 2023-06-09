/**
 * NOTE: These are the new functions meant to replace most everything
 * in the syncAllEntriesForUser.ts file, which got way too complicated.
 */

import { FilmEntry } from "../db/entities";
import { getFilmEntriesRepository, getUserRepository } from "../db/repositories";
import { findLastFilmsPage, scrapeWatchesByPage } from "./letterboxd";
import { scrapeAllWatchesByPage } from "./letterboxd-scrapers";

import { logger } from "./logger";

export class SyncLetterboxdError extends Error {
  synced?: FilmEntry[];
  username?: string;

  constructor(message: string, { synced, username }: { synced?: FilmEntry[]; username?: string; } = {}) {
    super(message);
    this.username = username;
    this.synced = synced;
  }
}

export async function syncRecentUserWatches({ userId, maxSync = 30 }: { userId: number; maxSync?: number; }) {
  return await syncUserWatches({ userId, maxSync })
}

export async function syncAllUserWatches({ userId }: { userId: number; }) {
  return await syncUserWatches({ userId, breakOnDuplicates: { active: false }})
}

interface BreakOnDuplicatesConfig {
  active: boolean;
  startOnPage?: number;
}

interface SyncUserWatchesOptions {
  userId: number;
  breakOnDuplicates?: BreakOnDuplicatesConfig;
  maxSync?: number;
}

export async function syncUserWatches({
  userId,
  breakOnDuplicates = {
    active: false
  },
  maxSync
}: SyncUserWatchesOptions) {
  let syncedWatches: FilmEntry[] = [];
  const UsersRepo = await getUserRepository();

  await UsersRepo.setLastEntriesUpdateAttempt(userId);

  const { username } = await checkUserId(userId);
  const lastWatchesPage = await findLastFilmsPage(username, '/by/rated-date/');

  const collectionDate = new Date();

  try {
    for (let page = 1; page <= lastWatchesPage; page++) {
      logger.verbose(`Beginning to process page ${page}`);
      const breakOnDupesThisPage = breakOnDuplicates.active 
        && (!breakOnDuplicates.startOnPage || breakOnDuplicates.startOnPage === page);

      const syncedForPage = await syncWatchesForPage({
        userId,
        username,
        page,
        breakOnDuplicates: breakOnDupesThisPage,
        collectionDate,
        syncCount: syncedWatches.length,
        maxSync
      });

      if (syncedForPage.length === 0) {
        // when moving through the pages forward, as soon
        // as we encounter a page with no ratings, we can
        // assume we don't need to continue through pages
        logger.verbose(`No watches were found for page ${page}, shutting down`);
        break;
      }

      syncedWatches = syncedWatches.concat(syncedForPage);
      logger.verbose(`Page ${page} processed, found and synced ${syncedForPage.length} watches (total: ${syncedWatches.length})`);
      
      if (maxSync && syncedWatches.length >= maxSync) {
        logger.info(`Reached the max sync count of ${maxSync}, shutting down`);
        break;
      }
    }
  } catch (error) {
    let message = "Unknown error occurred";
    if (error instanceof Error) {
      throw error;
      // message = error.message;
    }
    if (typeof error === "string") {
      message = error;
    }
    throw new SyncLetterboxdError(message, { synced: syncedWatches, username });
  }

  // set last synced date for this user
  await UsersRepo.setLastEntriesUpdated(userId);

  const synced: {
    watches: FilmEntry[];
  } = {
    watches: syncedWatches
  };

  return { synced, userId, username };
}

interface SyncPageOptions {
  userId: number;
  username: string;
  page: number;
  breakOnDuplicates?: boolean;
  collectionDate: Date;
  syncCount: number;
  maxSync?: number;
}
  
async function syncWatchesForPage({ 
  userId, 
  username, 
  page, 
  breakOnDuplicates = false, 
  collectionDate, 
  syncCount, 
  maxSync 
}: SyncPageOptions) {
  const FilmEntriesRepo = await getFilmEntriesRepository();
  const { watches } = await scrapeWatchesByPage({ username, page, collectionDate, syncCount, maxSync });

  if (watches.length === 0) {
    return [];
  }

  const syncedForPage: FilmEntry[] = [];

  for (let i = 0; i <= watches.length; i++) {
    const watched = watches[i];
    if (!watched) {
      break;
    }

    const {
      movieId,
      name,
      letterboxdSlug,
      stars,
      heart
    } = watched;

    if (typeof movieId !== "number") {
      throw new Error(`Invalid TMDB ID: ${movieId} (${typeof movieId})`);
    }

    if (typeof name !== "string") {
      throw new Error(`Invalid name ${name} (${typeof name})`);
    }

    try {
      if (breakOnDuplicates) {
        const checkDupe = {
          movieId,
          userId,
          letterboxdSlug,
          name,
          stars,
          heart
        };
        const found = await FilmEntriesRepo.findOneBy(checkDupe);
        
        if (found) {
          break;
        }
      }
      
      watched.userId = userId;
      logger.debug(`Saving ${watched.name}:`, JSON.stringify(watched));
      const created = FilmEntriesRepo.create(watched);
      const saved = await FilmEntriesRepo.save(created);

      syncedForPage.push(saved);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const fullMessage = `Error while syncing watches for Letterboxd user ${username} for user ID ${userId}: ${errorMessage}`;
      console.log(fullMessage)
      throw new Error(fullMessage);
    }
  }

  return syncedForPage;
}

async function checkUserId(userId: number) {
  const UsersRepo = await getUserRepository();
  const user = await UsersRepo.findOneBy({ 
    id: userId
  });

  if (!user) {
    throw new SyncLetterboxdError('User does not exist', { synced: [] });
  }

  return user;
}

/**
 * Scrapes for ALL ratings, but on a per page basis (not recursive).
 * 
 * This method is meant to be called by a lambda that is processing 
 * just one page at a time, starting with the earliest added review.
 * 
 */
export interface SyncAllForUserPerPageOptions {
  userId: number;
  username: string;
  page: number;
}

export async function syncAllForUserPerPage({ userId, username, page }: SyncAllForUserPerPageOptions) {
  const { url, watches } = await scrapeAllWatchesByPage({ username, page });

  if (watches.length === 0) {
    return [];
  }

  const syncedForPage: FilmEntry[] = [];
  const FilmEntriesRepo = await getFilmEntriesRepository();

  for (let i = 0; i <= watches.length; i++) {
    const watched = watches[i];
    if (!watched) {
      continue;
    }

    const { movieId, name } = watched;

    if (typeof movieId !== "number") {
      throw new Error(`Invalid TMDB ID: ${movieId} (${typeof movieId})`);
    }

    if (typeof name !== "string") {
      throw new Error(`Invalid name ${name} (${typeof name})`);
    }

    try {
      watched.userId = userId;
      logger.debug(`Saving ${watched.name}:`, JSON.stringify(watched));
      const created = FilmEntriesRepo.create(watched);
      syncedForPage.push(created);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const fullMessage = `Error while SCRAPING watches for Letterboxd url ${url}: ${errorMessage}`;
      console.log(fullMessage)
      throw new Error(fullMessage);
    }
  }

  try {
    // ONE database query per page hopefully makes this slightly faster
    const saved = await FilmEntriesRepo.save(syncedForPage);
    logger.verbose(`Successfully synced ${saved.length} movies for user ${username} (from ${url})`)
    return saved;
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const fullMessage = `Error while SAVING watches for Letterboxd url ${url}: ${errorMessage}`;
    console.log(fullMessage)
    throw new Error(fullMessage);
  }

  
}