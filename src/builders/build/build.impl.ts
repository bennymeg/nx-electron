import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { runWebpack, BuildResult } from '@angular-devkit/build-webpack';

import { getSourceRoot } from '../../utils/workspace';
import { getElectronWebpackConfig } from '../../utils/electron.config';
import { OUT_FILENAME } from '../../utils/config';
import { BuildBuilderOptions } from '../../utils/types';
import { normalizeBuildOptions } from '../../utils/normalize';

import { Observable, from } from 'rxjs';
import { resolve } from 'path';
import { map, concatMap } from 'rxjs/operators';

try {
  require('dotenv').config();
} catch (e) {}

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
        OUT_FILENAME
      );
      return buildEvent as ElectronBuildEvent;
    })
  );
}
