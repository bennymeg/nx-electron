import { join, resolve } from 'path';
import { map, tap } from 'rxjs/operators';
import { eachValueFrom } from 'rxjs-for-await';

import { ExecutorContext } from '@nrwl/devkit';
import { runWebpack } from '@nrwl/workspace/src/utilities/run-webpack';
import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { calculateProjectDependencies, checkDependentProjectsHaveBeenBuilt, createTmpTsConfig } from '@nrwl/workspace/src/utilities/buildable-libs-utils';

import { getElectronWebpackConfig } from '../../utils/electron.config';
import { normalizeBuildOptions } from '../../utils/normalize';
import { BuildBuilderOptions } from '../../utils/types';
import { getSourceRoot } from '../../utils/workspace';
import { MAIN_OUTPUT_FILENAME } from '../../utils/config';
import { generatePackageJson } from '../../utils/generate-package-json';
import webpack from 'webpack';

try {
  require('dotenv').config();
} catch (e) {}

export type ElectronBuildEvent = {
  outfile: string;
  success: boolean;
};

export interface BuildElectronBuilderOptions extends BuildBuilderOptions {
  optimization?: boolean;
  sourceMap?: boolean;
  buildLibsFromSource?: boolean;
  generatePackageJson?: boolean;
  implicitDependencies: Array<string>;
  externalDependencies: 'all' | 'none' | Array<string>;
}

export interface NormalizedBuildElectronBuilderOptions extends BuildElectronBuilderOptions {
  webpackConfig: string;
}


export function executor(rawOptions: BuildElectronBuilderOptions, context: ExecutorContext): AsyncIterableIterator<ElectronBuildEvent> {
  const { sourceRoot, projectRoot } = getSourceRoot(context);
  const normalizedOptions = normalizeBuildOptions( rawOptions, context.root, sourceRoot, projectRoot);
  const projGraph = readCachedProjectGraph();

  if (!normalizedOptions.buildLibsFromSource) {
    const { target, dependencies } = 
      calculateProjectDependencies(projGraph, context.root, context.projectName, context.targetName, context.configurationName);

    normalizedOptions.tsConfig = createTmpTsConfig(normalizedOptions.tsConfig, context.root, target.data.root, dependencies);

    if (!checkDependentProjectsHaveBeenBuilt(context.root, context.projectName, context.targetName, dependencies)) {
      return { success: false } as any;
    }
  }

  if (normalizedOptions.generatePackageJson) {
    generatePackageJson(context.projectName, projGraph, normalizedOptions);
  }

  let config = getElectronWebpackConfig(normalizedOptions);
  if (normalizedOptions.webpackConfig) {
    config = require(normalizedOptions.webpackConfig)(config, {
      normalizedOptions,
      configuration: context.configurationName,
    });
  }
  config.entry['preload'] = join(normalizedOptions.sourceRoot, 'app/api/preload.ts');


  return eachValueFrom(
    runWebpack(config, webpack).pipe(
      tap((stats) => {
        console.info(stats.toString(config.stats));
      }),
      map((stats) => {
        return {
          success: !stats.hasErrors(),
          outfile: resolve(context.root, normalizedOptions.outputPath, MAIN_OUTPUT_FILENAME)
        } as ElectronBuildEvent;
      })
    )
  );
}

export default executor;
