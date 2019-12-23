import { BuilderContext, createBuilder, BuilderOutput } from '@angular-devkit/architect';
import { JsonObject, workspaces } from '@angular-devkit/core';
import { serialHooks } from 'electron-packager/src/hooks';
import { Options as ElectronPackagerOptions } from 'electron-packager';
import electronPackager from 'electron-packager';

import { join } from 'path';
import { sync as removeSync } from 'rimraf';
import { writeFile, readFile, readFileSync, statSync } from 'fs';
import { promisify } from 'util';

import { Observable, from, of } from 'rxjs';
import { map, concatMap } from 'rxjs/operators';
import { normalizePackagingOptions } from '../../utils/normalize';
import { NodeJsSyncHost } from '@angular-devkit/core/node';

try {
  require('dotenv').config();
} catch (e) {}

const writeFileAsync = (path: string, data: string) => promisify(writeFile)(path, data);
const readFileAsync = (path: string) => promisify(readFile)(path);

export interface PackageElectronBuilderOptions extends ElectronPackagerOptions {
  name: string;
  frontendProject: string;
}

export interface PackageElectronBuilderOutput extends BuilderOutput {
  target?: any,
  outputPath: string | string[];
}

export default createBuilder<JsonObject & PackageElectronBuilderOptions>(run);

function run(
  options: JsonObject & PackageElectronBuilderOptions,
  context: BuilderContext
): Observable<PackageElectronBuilderOutput> {
  return from(getSourceRoot(context)).pipe(
    map(sourceRoot =>
      normalizePackagingOptions(options, context.workspaceRoot, sourceRoot)
    ),
    map(options => 
      mergePresetOptions(options)
    ),
    map(options => 
      addMissingDefaultOptions(options)
    ),
    concatMap(async (options) => {
      options.afterCopy = [serialHooks([
        (buildPath, electronVersion, platform, arch) => {
          return writeFileAsync(join(buildPath, 'index.js'), `const Main = require('./dist/apps/${options.name}/main');`);
        },
        (buildPath, electronVersion, platform, arch) => {
          return new Promise((resolve, reject) => {
            // remove src files (./apps directory)
            if (statSync(join(buildPath, 'apps')).isDirectory()) {
              try {
                removeSync(join(buildPath, 'apps'));
              } catch (error) {
                reject(error);
              }
            }

            resolve();
          });
        }
      ])];

      async function packagerWrapper() {
        let result: PackageElectronBuilderOutput;
        let outputPath: string | string[];
        let success: boolean = true;

        try {
          outputPath = await electronPackager(options);
        } catch(error) {
          success = false;
          console.error('Packaging failed:', error);
        }

        result = { success, outputPath };

        return result;
    }

      return await packagerWrapper();
    })
  );
}

async function getSourceRoot(context: BuilderContext) {
  const workspaceHost = workspaces.createWorkspaceHost(new NodeJsSyncHost());
  const { workspace } = await workspaces.readWorkspace(
    context.workspaceRoot,
    workspaceHost
  );

  if (workspace.projects.get(context.target.project).sourceRoot) {
    return workspace.projects.get(context.target.project).sourceRoot;
  } else {
    context.reportStatus('Error');
    const message = `${context.target.project} does not have a sourceRoot. Please define one.`;
    context.logger.error(message);
    throw new Error(message);
  }
}

function mergePresetOptions(options: PackageElectronBuilderOptions): PackageElectronBuilderOptions {
  // lead preset options file
  const externalOptionsPath: string = join(options.dir, options['sourceRoot'], 'app', 'options', 'packager.options.json');

  if (statSync(externalOptionsPath).isFile()) {
    const rawData = readFileSync(externalOptionsPath, 'utf8')
    const externalOptions = JSON.parse(rawData);
    options = Object.assign(options, externalOptions);
  }

  return options;
}

function addMissingDefaultOptions(options: PackageElectronBuilderOptions): PackageElectronBuilderOptions {
  //todo: add appVersion

  // remove unset options (use electron packager default where possible)
  Object.keys(options).forEach((key) => (options[key] === '') && delete options[key]);

  return options;
}
