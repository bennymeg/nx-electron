import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { Configuration } from 'webpack';
import { merge } from 'webpack-merge';
import nodeExternals from 'webpack-node-externals';
import TerserPlugin from 'terser-webpack-plugin';

import { BuildElectronBuilderOptions } from '../executors/build/executor';
import { getBaseWebpackPartial } from './config';

function getElectronPartial(options: BuildElectronBuilderOptions): Configuration {
  const webpackConfig: Configuration = {
    output: {
      libraryTarget: 'commonjs'
    },
    target: 'electron-main',
    node: false
  };

  if (options.optimization) {
    webpackConfig.optimization = {
      minimize: false,
      concatenateModules: false
    };
  }

  if (options.obfuscate) {
    const obfuscationOptimization = {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          // Exclude uglification for the `vendor` chunk
          // chunkFilter: (chunk) => chunk.name !== 'vendor', // use test/include/exclude options instead
          parallel: true,
          terserOptions: {
            mangle: true,
            keep_fnames: false,
            toplevel: true,
            output: {
              comments: false
            }
          }
        }),
      ],
    };

    if (webpackConfig.optimization) {
      webpackConfig.optimization = Object.assign(webpackConfig.optimization, obfuscationOptimization);
    } else {
      webpackConfig.optimization = obfuscationOptimization;
    }
  }

  if (options.externalDependencies === 'all') {
    const modulesDir = `${appRootPath}/node_modules`;
    webpackConfig.externals = [nodeExternals({ modulesDir })];
  } else if (Array.isArray(options.externalDependencies)) {
    webpackConfig.externals = [
      function (context, callback: Function) {
        if (options.externalDependencies.includes(context.request)) {
          // not bundled
          return callback(null, `commonjs ${context.request}`);
        }
        // bundled
        callback();
      },
    ];
  }
  return webpackConfig;
}

export function getElectronWebpackConfig(options: BuildElectronBuilderOptions) {
  return merge([getBaseWebpackPartial(options), getElectronPartial(options)]);
}
