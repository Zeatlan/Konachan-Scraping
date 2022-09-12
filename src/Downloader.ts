/**
 * Copyright (c) Zeatlan, Inc. Licensed under the MIT Licence.
 * See the LICENCE file in the project root for details.
 */

import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';
import { createWriteStream } from 'fs';
import sharp from 'sharp';
import childProcess from "child_process";

export default class Downloader {
  basePath: string;
  outputDir: string;
  images: string[];
  artistName: string;

  constructor(images: string[], artistName: string, outputDir: string = 'artists') {
    this.outputDir = outputDir;
    this.artistName = artistName;
    this.basePath = path.join(this.outputDir, artistName)
    this.images = images;
  }

  getBasePath() {
    return this.basePath;
  }

  /**
   * Check if file already exists
   * @param {string} filename - name of the file 
   * @returns Promise<Boolean>
   */
  async isFileAlreadyExists(filename: string): Promise<Boolean> {
    try {
      await fs.access(path.join(this.basePath, filename));
      return true;
    }catch(e) {
      return false;
    }
  }

  /**
   * Generate folder based on the actual artist
   */
  async generateFolder() {
    try {
      // Folder already exists
      await fs.access(path.join(this.basePath));
    }catch(e){
      await fs.mkdir(path.join(this.basePath));
      console.log(`\n👍 New folder initialized \n`);
    }
  }

  /**
   * Download image
   * @param {string} filename - Name of the file
   */
  async downloadImage(filename: string) {
    const name = path.basename(filename).substring(0, 28) + ".jpg";
    
    if(await this.isFileAlreadyExists(name)) return;
    
    try {
      return new Promise(async (resolve, reject) => {
        const response = await axios.default.get(filename, { responseType: "stream" });

        const fileStream = createWriteStream(path.join(this.basePath, name));
        const w = response.data.pipe(fileStream);

        w.on('finish', () => {
          setTimeout(() => {
            this.images.splice(this.images.indexOf(filename), 1);

            resolve(0);
          }, 100);
        })

        w.on('error', (e: any) => {
          console.log(e);
          // reject(0);
        })
      })
    }catch(e) {}
  }

  /**
   * Compress the file with Sharp (And convert it to JPEG format)
   * @param {string} file - File path
   */
  async compressFiles(file: string) {
    const filename = path.basename(file);
    const filepath = path.join(this.basePath, filename);

    try {
      await sharp(filepath).toFormat("jpeg", { mozjpeg: true }).toFile(path.join(this.basePath, `c-${filename.split('.jpg')[0]}.jpeg`))
      await fs.rm(filepath);
    }catch(e) {
      console.error('Error while compressing the image ' + filename)
    }
  }

  /**
   * Open folder in the explorer
   */
  openInExplorer() {
    childProcess.exec(`start "" "${this.basePath}"`)
  }
}