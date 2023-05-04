import { parseMovieTitleFromImage, parseViewingData, parseWatchPoster, tryLetterboxd } from "./letterboxd";
import * as cheerio from "cheerio";
import { logger } from "./logger";
import { FilmEntry } from "../db/entities";

export type LetterboxdWatchSortBy = 'date' | 'date-earliest' | 'rated-date' | 'rated-date-earliest';

export async function NEWscrapeWatchesByPage({
  username,
  page,
  by
}: {
  username: string;
  page: number;
  by: LetterboxdWatchSortBy;
}) {
  // for all: https://letterboxd.com/rhodesjason/films/by/date-earliest/size/large/page/24/
  // for recent: https://letterboxd.com/rhodesjason/films/by/rated-date/size/large/page/3/

  const url = `https://letterboxd.com/${username}/films/by/${by}/size/large/page/${page}/`;
  const { data } = await tryLetterboxd(url);
  const $ = cheerio.load(data);
  const watchElements = $('.poster-list li');

  if (!watchElements.length) {
    logger.verbose(`No watches found for ${url}`);
    return { url, watches: [] };
  }

  logger.verbose(`Starting watch sync for page: ${url}`);

  const watchElementsArray = Array.from(watchElements);
  const watches: Partial<FilmEntry>[] = [];
  for (let i = 0; i < watchElementsArray.length; i++) {
    const element = watchElementsArray[i];
    const $el = $(element);

    const posterDetails = await parseWatchPoster($el);
    const movieTitle = await parseMovieTitleFromImage($el);
    const viewData = await parseViewingData($el);
    
    watches.push({
      ...posterDetails,
      ...movieTitle,
      ...viewData
    });
  }

  return { url, watches };
}

export async function scrapeAllWatchesByPage({ username, page }: { username: string; page: number; }) {
  return await NEWscrapeWatchesByPage({ username, page, by: 'date-earliest' });
}

export async function scrapeRecentWatchesByPage({ username }: { username: string; }) {
  return await NEWscrapeWatchesByPage({ username, page: 1, by: 'rated-date' });
}