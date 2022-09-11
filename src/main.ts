/**
 * Copyright (c) Zeatlan, Inc. Licensed under the MIT Licence.
 * See the LICENCE file in the project root for details.
 */

import inquirer from "inquirer";
import KonachanPuppet from "./KonachanPuppet.js";
import Downloader from './Downloader.js';
import path from "path";

const URL = 'https://konachan.com/';

const init = () => {
  console.log(`\x1b[33mKonachan Scraper [v1.0.0]\x1b[0m`)
  console.log();

  mainMenu();
}

const mainMenu = async () => {
  const menu = await inquirer.prompt([
    {
      type: 'list',
      name: 'main',
      message: 'What do you want to do ?',
      choices: ['Get all images from artist', 'Exit']
    }
  ])

  if(menu.main) {
    if(menu.main === 'Get all images from artist') {
      await initPuppet();
    }else {
      process.exit(0);
    }
  }
}

const initPuppet = async () => {
  // ************************************
  // *           Init section           *
  // ************************************
  const puppet = new KonachanPuppet();
  await puppet.initialize({ headless: true });
  await puppet.goTo(URL);

  console.log();

  scraping(puppet);
}

const scraping = async (puppet: KonachanPuppet) => {
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
    return mainMenu();
  }

  let artistName = artistSearch.artist.toLowerCase();
  
  await puppet.search(artistName);

  await puppet.waitForSelector("a.directlink").catch(() => {
    console.log(`🙏 Sorry, couldn't find ${artistName} on ${URL}.\n`);
    return mainMenu();
  });

  let imagesUrl = await puppet.getElements("a.directlink", "href");
  if(!imagesUrl) return;

  // Check if there are pages
  const pages = await puppet.getElement(".pagination");
  if(!pages) return;

  
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
      nbPages.push(`${URL}/post?page=${i}&tags=${artistName}`)
    }
    
    if(nbPages) {
      for(const page of nbPages!) {
        await puppet.goTo(page);
        await puppet.waitForSelector("a.directlink").catch(async () => {
          console.log(`😥 You made Haruka cry. retrying...`)
          await puppet.goTo(page);
          await puppet.waitForSelector("a.directlink");
        });

        imagesUrl = imagesUrl.concat(await puppet.getElements("a.directlink", "href"));
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

  promises = [];
  nbImages = [];
  mainMenu();
}

init();