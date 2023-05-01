import { SyncType, SyncStatus, SyncTrigger } from "../../common/types/db";
import { Sync } from "../../db/entities";
import { 
  getSyncRepository, 
  getPopularLetterboxdMoviesRepository 
} from "../../db/repositories";
import { BetterloxApiError } from "../BetterloxApiError";
import { ScrapedMovie, scrapeMoviesByPage, scrapeMoviesOverPages } from "../letterboxd";
import { MoreThan } from "typeorm";
import { GENRES } from "../../common/constants";
import axios from "axios";
import { logger as loxDBLogger } from "../logger";

export interface SyncAllMoviesByDateRangeOptions {
  startYear: number;
  endYear: number;
  moviesPerYear: number;
}

async function processPopularPage(set: Partial<ScrapedMovie>[]) {
  const PopularLetterboxdMoviesRepo = await getPopularLetterboxdMoviesRepository();
  const processed: ScrapedMovie[] = [];
  for (let i = 0; i < set.length; i++) {
    const popularMovieRecord = set[i];
    try {
      const created = PopularLetterboxdMoviesRepo.create(popularMovieRecord);
      processed.push(await PopularLetterboxdMoviesRepo.save(created));
    } catch (error: unknown) {
      if (error instanceof BetterloxApiError) {
        throw error;
      }

      loxDBLogger.error('Error found while processing page of popular movies', popularMovieRecord.name);
      throw new BetterloxApiError('', { error });
    }
  }
  return processed;
}

export interface SyncPopularMoviesPerYearOptions {
  yearBatchSize?: number;
  force?: boolean;
  moviesPerYear: number;
  startYear?: number;
  endYear?: number;
}

export async function syncPopularMoviesPerYear({
  moviesPerYear,
  startYear = 1900,
  endYear,
  yearBatchSize = 20
}: SyncPopularMoviesPerYearOptions) {
  const SyncRepo = await getSyncRepository();
  const { sync } = await SyncRepo.queueSync({ trigger: SyncTrigger.SYSTEM });
  sync.type = SyncType.POPULAR_MOVIES_YEAR;
  await SyncRepo.save(sync);

  if (!endYear) {
    loxDBLogger.verbose('Popular Year Sync: Calculating end year because one was not specifically provided');
    const lastPopularYearSync = await SyncRepo.find({
      where: {
        type: SyncType.POPULAR_MOVIES_YEAR,
        status: SyncStatus.COMPLETE
      },
      order: {
        finished: 'DESC'
      },
      take: 1
    });

    loxDBLogger.verbose('Previous Popular Year Syncs:', JSON.stringify(lastPopularYearSync));

    const currentYear = (new Date()).getUTCFullYear();

    if (lastPopularYearSync.length > 0 && lastPopularYearSync[0].secondaryId) {
      const lastRange = lastPopularYearSync[0].secondaryId;
      const possibleStartYear = Number(lastRange.substring(5));
      if (possibleStartYear < currentYear) {
        startYear = possibleStartYear;
      }
    }

    endYear = Math.min(currentYear, startYear + yearBatchSize);
  }

  loxDBLogger.info('Syncing popular movies for year range:', `${startYear} - ${endYear}`);
  // sync movies from letterboxd /by/year pages
  const numSynced = await syncPopularMoviesByDateRange({
    startYear,
    endYear,
    moviesPerYear
  });

  await SyncRepo.endSync(sync, {
    status: SyncStatus.COMPLETE,
    secondaryId: `${startYear}-${endYear}`,
    numSynced
  });

  return {
    cachedCount: numSynced,
    startYear,
    endYear
  };
}

export async function syncPopularMoviesByDateRange({
  startYear,
  endYear,
  moviesPerYear
}: SyncAllMoviesByDateRangeOptions) {
  let results: ScrapedMovie[] = [];
  for (let year = startYear; year < endYear; year++) {
    
    loxDBLogger.verbose(`Syncing popular letterboxd movies for year: ${year}`);

    const baseUrl = `https://letterboxd.com/films/ajax/popular/year/${year}/size/small`;
    try {
      const nextBatch = await scrapeMoviesOverPages({ baseUrl, maxMovies: moviesPerYear, processPage: processPopularPage });
      results = results.concat(nextBatch);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const { status, statusText } = error.response || {};
        
        if (error.response?.status === 404) {
          continue;
        }
      }
      if (error instanceof BetterloxApiError) {
        throw error;
      }
      
      loxDBLogger.error('Error found during year-by-year page scraping and processing, for year:', year);
      throw new BetterloxApiError('', { error });
    }
  }

  return results.length;
}

const excludedGenresForSyncing = ['TV Movie'];
const genrePaths = GENRES
  .filter(g => !excludedGenresForSyncing.includes(g))
  .map((genre) => {
    return genre.toLowerCase().replace(/ /g, '-');
  });

interface SyncPopularMoviesPerGenreOptions {
  moviesPerGenre: number;
}

export async function syncPopularMoviesPerGenre({
  moviesPerGenre
}: SyncPopularMoviesPerGenreOptions) {
  const SyncRepo = await getSyncRepository();
  const { sync } = await SyncRepo.queueSync({ trigger: SyncTrigger.SYSTEM });
  sync.type = SyncType.POPULAR_MOVIES_GENRE;
  SyncRepo.save(sync);

  let results: ScrapedMovie[] = [];

  for (let i = 0; i < genrePaths.length; i++) {
    const genre = genrePaths[i];
    loxDBLogger.verbose(`Retrieving popular movies for genre: ${genre}`);
    const baseUrl = `https://letterboxd.com/films/ajax/popular/genre/${genre}/size/small`;
    try {
      const nextBatch = await scrapeMoviesOverPages({ baseUrl, maxMovies: moviesPerGenre, processPage: processPopularPage });
      results = results.concat(nextBatch);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        loxDBLogger.error('Axios error with genres', 'url:', error.request?.url, 'error message:', error.message, 'status text:', error.response?.statusText, 'status:', error.response?.status);
        throw error;
      }
      if (error instanceof BetterloxApiError) {
        throw error;
      }
      const message = `Error found during genre page scraping and processing, for genre: ${genre}`;
      loxDBLogger.error(message, error.message);
      throw new BetterloxApiError(message, { error });
    }
  }

  await SyncRepo.endSync(sync, {
    status: SyncStatus.COMPLETE,
    numSynced: results.length
  });

  return {
    movies: results.map(m => m.name),
    cachedCount: results.length
  };
}