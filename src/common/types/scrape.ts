export interface ScrapedLetterboxdList {
  letterboxdListId: number;
  publishDate?: string;
  lastUpdated?: string;
  title: string;
  description?: string;
  username: string;
  url: string;
  movies: number[];
  isRanked: boolean;
  visibility: 'public' | 'private'
}