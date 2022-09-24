/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Configuration,
  ProgressPlugin,
  DefinePlugin,
  WebpackPluginInstance,
} from 'webpack';

import * as ts from 'typescript';
import { join } from 'path';

import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { readTsConfig } from '@nrwl/workspace/src/utilities/typescript';
import { BuildBuilderOptions } from './types';

export const MAIN_OUTPUT_FILENAME = 'main.js';
export const INDEX_OUTPUT_FILENAME = 'index.js';
export const DEFAULT_APPS_DIR = 'apps';
export const OUT_FILENAME_TEMPLATE = '[name].js';

export function getBaseWebpackPartial(
  options: BuildBuilderOptions
): Configuration {
  const { options: compilerOptions } = readTsConfig(options.tsConfig);
  const supportsEs2015 =
    compilerOptions.target !== ts.ScriptTarget.ES3 &&
    compilerOptions.target !== ts.ScriptTarget.ES5;
  const mainFields = [...(supportsEs2015 ? ['es2015'] : []), 'module', 'main'];
  const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];

  const additionalEntryPoints =
    options.additionalEntryPoints?.reduce(
      (obj, current) => ({ ...obj, [current.entryName]: current.entryPath }),
      {} as { [entryName: string]: string }
    ) ?? {};

  const webpackConfig: Configuration = {
    entry: {
      main: [options.main],
      ...additionalEntryPoints,
      // preload entries will be included dynamically
    },
    devtool: options.sourceMap ? 'source-map' : false,
    mode: options.optimization ? 'production' : 'development',
    output: {
      path: options.outputPath,
      filename: (pathData) => {
        return pathData.chunk.name === 'main'
          ? options.outputFileName
          : OUT_FILENAME_TEMPLATE;
      },
      hashFunction: 'xxhash64',
      // Disabled for performance
      pathinfo: false,
    },
    module: {
      // Enabled for performance
      // unsafeCache: true,
      rules: [
        {
          test: /\.([jt])sx?$/,
          loader: require.resolve(`ts-loader`),
          exclude: /node_modules/,
          options: {
            configFile: options.tsConfig,
            transpileOnly: true,
            // https://github.com/TypeStrong/ts-loader/pull/685
            experimentalWatchApi: true,
          },
        },
      ],
    },
    resolve: {
      extensions,
      alias: getAliases(options),
      plugins: [
        new TsConfigPathsPlugin({
          configFile: options.tsConfig,
          extensions,
          mainFields,
        }) as any,
      ],
      mainFields,
    },
    performance: {
      hints: false,
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        typescript: {
          configFile: options.tsConfig,
          memoryLimit: options.memoryLimit || 2018,
        },
      }),
      new DefinePlugin({
        __BUILD_VERSION__: JSON.stringify(
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require(join(options.root, 'package.json')).version
        ),
        __BUILD_DATE__: Date.now(),
      }),
    ],
    watch: options.watch,
    watchOptions: {
      poll: options.poll,
    },
    stats: options.verbose ? 'verbose' : 'normal',
  };

  const extraPlugins: WebpackPluginInstance[] = [];

  if (options.progress) {
    extraPlugins.push(new ProgressPlugin());
  }

  if (options.extractLicenses) {
    extraPlugins.push(
      new LicenseWebpackPlugin({
        stats: {
          warnings: false,
          errors: false,
        },
        perChunkOutput: false,
        outputFilename: `3rdpartylicenses.txt`,
      }) as unknown as WebpackPluginInstance
    );
  }

  // process asset entries
  if (Array.isArray(options.assets) && options.assets.length > 0) {
    const copyWebpackPluginInstance = new CopyWebpackPlugin({
      patterns: options.assets.map((asset) => {
        return {
          context: asset.input,
          // Now we remove starting slash to make Webpack place it from the output root.
          to: asset.output,
          from: asset.glob,
          globOptions: {
            ignore: [
              '.gitkeep',
              '**/.DS_Store',
              '**/Thumbs.db',
              ...(asset.ignore ?? []),
            ],
            dot: true,
          },
        };
      }),
    });

    new CopyWebpackPlugin({
      patterns: options.assets.map((asset: any) => {
        return {
          context: asset.input,
          // Now we remove starting slash to make Webpack place it from the output root.
          to: asset.output,
          from: asset.glob,
          globOptions: {
            ignore: [
              '.gitkeep',
              '**/.DS_Store',
              '**/Thumbs.db',
              ...(asset.ignore ?? []),
            ],
            dot: true,
          },
        };
      }),
    });
    extraPlugins.push(copyWebpackPluginInstance);
  }

  webpackConfig.plugins = [...webpackConfig.plugins, ...extraPlugins];

  return webpackConfig;
}

function getAliases(options: BuildBuilderOptions): { [key: string]: string } {
  return options.fileReplacements.reduce(
    (aliases, replacement) => ({
      ...aliases,
      [replacement.replace]: replacement.with,
    }),
    {}
  );
}
