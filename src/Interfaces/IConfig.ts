/**
 * Copyright (c) Zeatlan, Inc. Licensed under the MIT Licence.
 * See the LICENCE file in the project root for details.
 */

import { ModeType } from "../Types/ModeType.js";

export default interface IConfig {
  mode: ModeType;
  outputDir: string;
}

