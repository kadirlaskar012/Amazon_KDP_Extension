import type { Book, QueueProgressState } from '../types';
import { parseProductPage } from '../parsers/productPage';
import { ProductCache } from './cache';
import { MAX_FETCHES_PER_SEARCH } from '../config';
import { getSettings } from '../storage';

export type StatusListener = (status: QueueProgressState) => void;
export type ItemFetchedListener = (asin: string, partial: Partial<Book>) => void;
export type CaptchaListener = (url: string) => void;

export class FetchQueueService {
  private queue: string[] = [];
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private captchaDetected: boolean = false;
  private currentProgress: number = 0;
  private totalCount: number = 0;
  private currentAsin?: string;
  private currentTabId?: number;

  private onStatusChange?: StatusListener;
  private onItemFetched?: ItemFetchedListener;
  private onCaptcha?: CaptchaListener;

  constructor(callbacks?: {
    onStatusChange?: StatusListener;
    onItemFetched?: ItemFetchedListener;
    onCaptcha?: CaptchaListener;
  }) {
    this.onStatusChange = callbacks?.onStatusChange;
    this.onItemFetched = callbacks?.onItemFetched;
    this.onCaptcha = callbacks?.onCaptcha;
  }

  public getStatus(): QueueProgressState {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      current: this.currentProgress,
      total: this.totalCount,
      captchaDetected: this.captchaDetected,
      currentAsin: this.currentAsin,
      message: this.captchaDetected
        ? "Amazon asked for verification, open Amazon and solve it, then resume."
        : this.isRunning
        ? `Fetching ${this.currentProgress}/${this.totalCount}`
        : 'Idle',
    };
  }

  private notifyStatus(): void {
    if (this.onStatusChange) {
      this.onStatusChange(this.getStatus());
    }
  }

  public async enqueue(asins: string[], tabId?: number): Promise<void> {
    this.currentTabId = tabId;
    this.captchaDetected = false;
    this.isPaused = false;

    // Limit to max fetches per search
    const uniqueAsins = Array.from(new Set(asins)).slice(0, MAX_FETCHES_PER_SEARCH);
    this.totalCount = uniqueAsins.length;
    this.currentProgress = 0;
    this.queue = [];

    // 1. Check cache first for instant resolution
    const cachedBooks = await ProductCache.getBatch(uniqueAsins);
    const toFetch: string[] = [];

    for (const asin of uniqueAsins) {
      if (cachedBooks[asin]) {
        this.currentProgress++;
        if (this.onItemFetched) {
          this.onItemFetched(asin, cachedBooks[asin]);
        }
      } else {
        toFetch.push(asin);
      }
    }

    this.queue = toFetch;
    this.notifyStatus();

    if (this.queue.length > 0 && !this.isRunning) {
      this.processQueue();
    }
  }

  public pause(): void {
    this.isPaused = true;
    this.notifyStatus();
  }

  public resume(): void {
    if (!this.isPaused && !this.captchaDetected) return;
    this.isPaused = false;
    this.captchaDetected = false;
    this.notifyStatus();
    if (!this.isRunning && this.queue.length > 0) {
      this.processQueue();
    }
  }

  public cancel(): void {
    this.queue = [];
    this.isRunning = false;
    this.isPaused = false;
    this.captchaDetected = false;
    this.currentAsin = undefined;
    this.notifyStatus();
  }

  private async sleepRandom(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async processQueue(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    const settings = await getSettings();
    if (settings.pauseAllFetching) {
      this.isPaused = true;
      this.isRunning = false;
      this.notifyStatus();
      return;
    }

    const minDelay = settings.fetchDelayMs?.min || 2000;
    const maxDelay = settings.fetchDelayMs?.max || 3000;

    try {
      while (this.queue.length > 0) {
        if (this.isPaused || this.captchaDetected) {
          break;
        }

        const asin = this.queue.shift();
        if (!asin) continue;

        this.currentAsin = asin;
        this.notifyStatus();

        // 2-3 seconds randomized rate limiting
        await this.sleepRandom(minDelay, maxDelay);

        const currentSettings = await getSettings();
        if (currentSettings.pauseAllFetching || this.isPaused || this.captchaDetected) {
          // Re-queue the asin if paused during delay or settings toggled
          if (currentSettings.pauseAllFetching) this.isPaused = true;
          this.queue.unshift(asin);
          break;
        }

        try {
          const productUrl = `https://www.amazon.com/dp/${asin}`;
          const response = await fetch(productUrl, {
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });

          const html = await response.text();
          const parsed = parseProductPage(html);

          // Hard Rule: If Amazon returns CAPTCHA or robot-check, STOP immediately
          if (parsed.isCaptcha) {
            this.captchaDetected = true;
            this.isPaused = true;
            // Put asin back at front so user can resume after solving
            this.queue.unshift(asin);
            this.notifyStatus();

            if (this.onCaptcha) {
              this.onCaptcha(productUrl);
            }
            break;
          }

          // Cache product details for 24 hours
          await ProductCache.set(asin, parsed);

          this.currentProgress++;
          if (this.onItemFetched) {
            this.onItemFetched(asin, parsed);
          }
        } catch (fetchErr) {
          console.warn(`[KDP FetchQueue] Error fetching ASIN ${asin}:`, fetchErr);
          // Don't crash; mark progress so queue doesn't hang
          this.currentProgress++;
        }

        this.notifyStatus();
      }
    } finally {
      this.isRunning = false;
      this.currentAsin = undefined;
      this.notifyStatus();
    }
  }
}
