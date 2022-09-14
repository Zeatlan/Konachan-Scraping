/**
 * Copyright (c) Zeatlan, Inc. Licensed under the MIT Licence.
 * See the LICENCE file in the project root for details.
 */

import inquirer from "inquirer";
import KonachanPuppet from "./KonachanPuppet.js";
import Downloader from './Downloader.js';
import path from "path";
import { readFile, writeFile } from 'fs/promises';
import IConfig from "./Interfaces/IConfig.js";


const URL = 'https://konachan.com/';


const init = async () => {
  const config = JSON.parse((await readFile('./src/config.json')).toString());
  const $ = JSON.parse((await readFile('./package.json')).toString())

  console.log(`\x1b[33mKonachan Scraper [v${$.version}]\x1b[0m`)
  console.log();

  mainMenu(config);
}

const mainMenu = async (config: IConfig): Promise<unknown> => {

  const switchMode = (config.mode === 'R18') ? 'R18 -> G' : 'G -> R18';

  const menu = await inquirer.prompt([
    {
      type: 'list',
      name: 'main',
      message: 'What do you want to do ?',
      choices: ['Get all images from artist', switchMode, 'Exit']
    }
  ]);

  if(menu.main) {
    if(menu.main === 'Get all images from artist') {
      await initPuppet(config);
    }

    if(menu.main === switchMode) {
      config.mode = (config.mode === 'R18') ? 'G': 'R18';
      await writeFile('./src/config.json', JSON.stringify(config));
      return Promise.resolve(mainMenu(config));
    }
    
    if(menu.main === 'Exit') {
      process.exit(0);
    }
  }
}

const initPuppet = async (config: IConfig) => {
  // ************************************
  // *           Init section           *
  // ************************************
  const puppet = new KonachanPuppet();
  await puppet.initialize({ headless: false });
  await puppet.goTo(URL).catch(() => {
    console.error(`Couldn't connect to konachan.com, please check your internet connection or konachan status, if everything is ok, please open a ticket on the github page.`)
    Promise.reject(mainMenu(config))
  })
  await puppet.waitForSelector('#tags')

  console.log();

  scraping(puppet, config);
}

const scraping = async (puppet: KonachanPuppet, config: IConfig) => {
  console.log('################################')

  // ************************************
  // *          Artist section          *
  // ************************************
  const artistSearch = await inquirer.prompt([
    {
      type: 'input',
      name: 'artist',
      message: "Type the artist you want to fetch (Don't forget the '_' between space)",
    }
  ]);

  if(artistSearch.artist === '') {
    console.error(`❌ Invalid artist name\n`);
    return mainMenu(config);
  }

  let artistName = artistSearch.artist.toLowerCase();
  
  await puppet.search(artistName);

  await puppet.waitForSelector("a.directlink").catch(() => {
    console.log(`🙏 Sorry, couldn't find ${artistName} on ${URL}.\n`);
    return mainMenu(config);
  });

  let imagesUrl = await puppet.getElements("a.directlink", "href");
  if(!imagesUrl) return;

  // Check if there are pages
  const pages = await puppet.getElement(".pagination");
  if(!pages) return;

  
  // ************************************
  // *          Switch section          *
  // ************************************
  const whatMode = await puppet.getElement('li.switch a', 'textContent');
  if(whatMode){
    if(config.mode === 'R18' && whatMode[0] === 'Explicit' || config.mode === 'G' && whatMode[0] === 'Safe Mode'){
      await puppet.switchMode(artistName!);
      console.log(`Successfully switched to ${config.mode} mode !`)
    }
  }

  
  // ************************************
  // *          Pages section           *
  // ************************************

  // Initialize Downloader
  const downloader = new Downloader(imagesUrl, artistName);

  // There are pages
  if(pages.length > 0) {
    let lastPage = await puppet.getElements(".pagination a", "textContent")
    lastPage!.splice(-1);

    let nbPages = [];
    for(let i = 1; i < parseInt(lastPage?.at(-1))+1; i++) {
      nbPages.push(`${URL}/post?page=${i}&tags=${artistName.replace('(', '%28').replace(')', '%29')}`)
    }

    // Delete first page
    nbPages.shift();
    
    if(nbPages) {
      for(const page of nbPages) {

        await puppet.goTo(page);
        await puppet.waitForSelector("a.directlink", { timeout: 20000 }).catch(async () => {
          let retrying = true;

          while(retrying) {
            await puppet.goTo(page);
            const selected = await puppet.waitForSelector("a.directlink", { timeout: 20000 }).catch(() => {});
            if(selected) retrying = false;
          }
        });
        imagesUrl = imagesUrl!.concat(await puppet.getElements("a.directlink", "href"));
      }
      
      await puppet.goTo(nbPages![0]);
    }
  }
  

  
  // ************************************
  // *          Download section        *
  // ************************************
  await downloader.generateFolder();
  console.log(`🤔 Downloading files, please wait...`)

  let nbImages = [...imagesUrl]

  // Memo
  for(let i = 0; i < nbImages.length; i++) {
    nbImages[i] = path.basename(nbImages[i]).substring(0, 28) + ".jpg";
  }

  // Initialize promises and nbImages (just for counting)
  let promises = [];

  for(let i = 0; i < imagesUrl.length; i++) {
    promises.push(downloader.downloadImage(imagesUrl[i]).catch(() => { console.error(`\nError while downloading ${imagesUrl![i]}`) }));

    if(i%20 === 0) {
      await Promise.all(promises);
      promises = [];
    }
  }

  await Promise.all(promises)

  
  // ************************************
  // *        Compression section       *
  // ************************************
  console.log(`🗄️ Compressing files...`)
  let promisesCompress = [];

  for(const img of nbImages) {
    promisesCompress.push(downloader.compressFiles(img));
  }

  await Promise.all(promisesCompress)
  console.log(`\n\x1b[32mAll files downloaded ! (\x1b[33m${nbImages.length} images from ${artistName}\x1b[32m)\x1b[0m`);
  console.log();

  // Open folder in explorer
  downloader.openInExplorer();

  promises = [];
  nbImages = [];
  return Promise.resolve(mainMenu(config));
}

init();