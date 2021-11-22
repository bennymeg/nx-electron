import { join, resolve } from 'path';
import { from, Observable } from 'rxjs';
import { concatMap, map, tap } from 'rxjs/operators';

import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { BuildResult, runWebpack } from '@angular-devkit/build-webpack';
import { JsonObject } from '@angular-devkit/core';

import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { calculateProjectDependencies, checkDependentProjectsHaveBeenBuilt, createTmpTsConfig } from '@nrwl/workspace/src/utils/buildable-libs-utils';

import { getElectronWebpackConfig } from '../../utils/electron.config';
import { normalizeBuildOptions } from '../../utils/normalize';
import { BuildBuilderOptions } from '../../utils/types';
import { getSourceRoot } from '../../utils/workspace';
import { MAIN_OUTPUT_FILENAME } from '../../utils/config';
import { generatePackageJson } from '../../utils/generate-package-json';

try {
  require('dotenv').config();
} catch (e) {}

export interface BuildElectronBuilderOptions extends BuildBuilderOptions {
  optimization?: boolean;
  sourceMap?: boolean;
  implicitDependencies: Array<string>;
  externalDependencies: 'all' | 'none' | Array<string>;
}

export type ElectronBuildEvent = BuildResult & {
  outfile: string;
};

export default createBuilder<JsonObject & BuildElectronBuilderOptions>(run);

function run( options: JsonObject & BuildElectronBuilderOptions, context: BuilderContext): Observable<ElectronBuildEvent> {
  const projGraph = readCachedProjectGraph();

  if (!options.buildLibsFromSource) {
    const { target, dependencies } = calculateProjectDependencies( projGraph, context);

    options.tsConfig = createTmpTsConfig(
      join(context.workspaceRoot, options.tsConfig),
      context.workspaceRoot,
      target.data.root,
      dependencies
    );

    if (!checkDependentProjectsHaveBeenBuilt(context, dependencies)) {
      return { success: false } as any;
    }
  }

  return from(getSourceRoot(context)).pipe(
    map(({ sourceRoot, projectRoot }) =>
      normalizeBuildOptions(options, context.workspaceRoot, sourceRoot, projectRoot)
    ),
    tap((normalizedOptions) => {
      if (normalizedOptions.generatePackageJson) {
        generatePackageJson(
          context.target.project,
          projGraph,
          normalizedOptions
        );
      }
    }),
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
