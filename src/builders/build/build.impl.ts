import { join, resolve } from 'path';
import { from, Observable } from 'rxjs';
import { concatMap, map } from 'rxjs/operators';

import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { BuildResult, runWebpack } from '@angular-devkit/build-webpack';
import { JsonObject } from '@angular-devkit/core';

import { getElectronWebpackConfig } from '../../utils/electron.config';
import { normalizeBuildOptions } from '../../utils/normalize';
import { BuildBuilderOptions } from '../../utils/types';
import { getSourceRoot } from '../../utils/workspace';

try {
  require('dotenv').config();
} catch (e) {}

const MAIN_OUTPUT_FILENAME = 'main.js';

export interface BuildElectronBuilderOptions extends BuildBuilderOptions {
  optimization?: boolean;
  sourceMap?: boolean;
  externalDependencies: 'all' | 'none' | string[];
}

export type ElectronBuildEvent = BuildResult & {
  outfile: string;
};

export default createBuilder<JsonObject & BuildElectronBuilderOptions>(run);

function run(
  options: JsonObject & BuildElectronBuilderOptions,
  context: BuilderContext
): Observable<ElectronBuildEvent> {
  return from(getSourceRoot(context)).pipe(
    map(sourceRoot =>
      normalizeBuildOptions(options, context.workspaceRoot, sourceRoot)
    ),
    map(options => {
      let config = getElectronWebpackConfig(options);
      if (options.webpackConfig) {
        config = require(options.webpackConfig)(config, {
          options,
          configuration: context.target.configuration
        });
      }
      config.entry['preload'] = join(options.sourceRoot, 'app/api/preload.ts');
      return config;
    }),
    concatMap(config =>
      runWebpack(config, context, {
        logging: stats => {
          context.logger.info(stats.toString(config.stats));
        }
      })
    ),
    map((buildEvent: BuildResult) => {
      buildEvent.outfile = resolve(
        context.workspaceRoot,
        options.outputPath,
        MAIN_OUTPUT_FILENAME
      );
      return buildEvent as ElectronBuildEvent;
    })
  );
}
