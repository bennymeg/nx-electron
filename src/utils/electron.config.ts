import { Configuration, BannerPlugin } from 'webpack';
import mergeWebpack from 'webpack-merge';
import nodeExternals from 'webpack-node-externals';
import UglifyJsPlugin from 'uglifyjs-webpack-plugin';

import { BuildElectronBuilderOptions } from '../builders/build/build.impl';
import { getBaseWebpackPartial } from './config';

function getElectronPartial(options: BuildElectronBuilderOptions): Configuration {
  const webpackConfig: Configuration = {
    output: {
      libraryTarget: 'commonjs'
    },
    target: 'node',
    node: false
  };

  if (options.optimization) {
    webpackConfig.optimization = {
      minimize: false,
      concatenateModules: false
    };
  } 
  // else if (options.obfuscate) {
  //   webpackConfig.optimization = {
  //     minimizer: [
  //       new UglifyJsPlugin({
  //         chunkFilter: (chunk) => {
  //           // Exclude uglification for the `vendor` chunk
  //           if (chunk.name === 'vendor') {
  //             return false;
  //           }
  
  //           return true;
  //         },
  //       }),
  //     ],
  //   }
  // }

  if (options.externalDependencies === 'all') {
    webpackConfig.externals = [nodeExternals()];
  } else if (Array.isArray(options.externalDependencies)) {
    webpackConfig.externals = [
      function(context, request, callback: Function) {
        if (options.externalDependencies.includes(request)) {
          // not bundled
          return callback(null, 'commonjs ' + request);
        }
        // bundled
        callback();
      }
    ];
  }
  return webpackConfig;
}

export function getElectronWebpackConfig(options: BuildElectronBuilderOptions) {
  return mergeWebpack(getBaseWebpackPartial(options), getElectronPartial(options)); // was array
}
