/**
 * Copyright (c) Zeatlan, Inc. Licensed under the MIT Licence.
 * See the LICENCE file in the project root for details.
 */

import puppeteer from 'puppeteer';
import { ElementType } from './Types/ElementType.js';
import { PuppeteerBlocker } from '@cliqz/adblocker-puppeteer';
import fetch from 'cross-fetch';


export default class KonachanPuppet {
  browser: puppeteer.Browser | null;
  mainPage: puppeteer.Page | null;
  searchInput: puppeteer.ElementHandle<Element> | null | undefined;
  blocker: PuppeteerBlocker | null;

  constructor() {
    this.browser = null;
    this.mainPage = null;
    this.searchInput = null;
    this.blocker = null;
  }

  /**
   * 
   * @param {Object} options 
   * @param {number} width - Width of the viewport
   * @param {number} height - Height of the viewport
   */
  async initialize(options: Object, width: number = 1920, height: number = 1080) {
    this.browser = await puppeteer.launch(options);
    this.mainPage = await this.browser.newPage();
    this.mainPage.setViewport({ width, height, deviceScaleFactor: 1 });

    this.blocker = await PuppeteerBlocker.fromPrebuiltAdsAndTracking(fetch);

    console.log('\n✅ Puppet initialized');
  }

  /**
   * Puppet to the indicated Url
   * @param url - URL to go
   */
  async goTo(url: string) {
    // Adblocking
    this.blocker!.enableBlockingInPage(this.mainPage!);

    try {
      await this.mainPage?.goto(url);
      console.log(`\n🔗 Browsing ${url}...`)
    }catch(e) {
      console.error(e);
    }
  }

  /**
   * Search input handle
   * @param {string} artist - Artist name
   */
  async search(artist: string) {
    this.searchInput = await this.mainPage?.$('input[name="tags"]');

    if(this.searchInput && this.mainPage) {
      await this.searchInput.click({ clickCount: 3})
      await this.searchInput.type(artist);
      await this.mainPage.keyboard.press('Enter');

      console.log(`\n🎨 Browsing ${artist}'s page`);
    }else{
      console.error(`Error, couldn't find the element, exiting.`);
      process.exit(0);
    }
  }

  /**
   * Wait for page to load completely
   * @pparam {Object} options
   * @return Promise<unknown>
   */
  async waitForNavigation(options: Object = {}): Promise<unknown> {
    return new Promise(resolve => resolve(this.mainPage?.waitForNavigation(options)));
  }

  /**
   * Wait for selector to appear
   * @param {string} selector  - HTML Selector
   * @param {Object} options
   * @returns Promise<unknown>
   */
  async waitForSelector(selector: string, options: Object = {}): Promise<unknown> {
    return new Promise((resolve, resject) => {
      return this.mainPage?.waitForSelector(selector, options).then(() => {
        resolve(true);
      }).catch(() => {
        resject(false);
      })
    })
  }

  /**
   * Get multiple elements on page
   * @param {string} element - HTML Selector
   * @param {ElementType} type - Type to extract
   * @returns Promise<any[] | undefined>
   */
  async getElements(element: string, type: ElementType = "div"): Promise<any[] | undefined> {
    try {
      if(type === 'href') return await this.mainPage?.$$eval(element, x => x.map((y: any) => y.href))
      if(type === 'textContent') return await this.mainPage?.$$eval(element, x => x.map((y: any) => y.textContent))
    }catch(e) {
      return [];
    }
  }

  /**
   * Get one element on page
   * @param {string} element - HTML Selector
   * @param {ElementType} type - Type to extract
   * @returns Promise<any[] | undefined>
   */
  async getElement(element: string, type: ElementType = "div"): Promise<any[] | undefined>  {
    try {
      if(type === 'div') return await this.mainPage?.$eval(element, (x: any) => [x.className]);
    }catch(e) {
      return [];
    }
  }
}