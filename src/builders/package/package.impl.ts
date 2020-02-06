import { BuilderContext, createBuilder, BuilderOutput } from '@angular-devkit/architect';
import { JsonObject, workspaces } from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';

import { serialHooks } from 'electron-packager/src/hooks';
import { Options as ElectronPackagerOptions } from 'electron-packager';
import electronPackager from 'electron-packager';

import { join } from 'path';
import { sync as removeSync } from 'rimraf';
import { writeFile, readFile, readFileSync, statSync, readdirSync } from 'fs';
import { promisify } from 'util';

import { Observable, from } from 'rxjs';
import { map, concatMap } from 'rxjs/operators';
import { normalizePackagingOptions } from '../../utils/normalize';

try {
  require('dotenv').config();
} catch (e) {}

const writeFileAsync = (path: string, data: string) => promisify(writeFile)(path, data);
const readFileAsync = (path: string) => promisify(readFile)(path);

export interface PackageElectronBuilderOptions extends ElectronPackagerOptions {
  name: string;
  frontendProject: string;
  out?: string;
}

export interface PackageElectronBuilderOutput extends BuilderOutput {
  target?: any;
  outputPath: string | string[];
}

export default createBuilder<JsonObject & PackageElectronBuilderOptions>(run);

function run(options: JsonObject & PackageElectronBuilderOptions, context: BuilderContext): Observable<PackageElectronBuilderOutput> {
  return from(getSourceRoot(context)).pipe(
    map(sourceRoot =>
      normalizePackagingOptions(options, context.workspaceRoot, sourceRoot)
    ),
    map(options => 
      mergePresetOptions(options)
    ),
    map(options => 
      addDefaultIgnoreOptions(options)
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
          return removeSourceFiles(options, buildPath);
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
    options = Object.assign(normalizeIgnoreOptions(options), normalizeIgnoreOptions(externalOptions));
  }

  return options;
}

function addDefaultIgnoreOptions(options: PackageElectronBuilderOptions): PackageElectronBuilderOptions {
  // add ignore options that ignore all the additional projects in the dist folder
  // const ignoreExtraProjects: RegExp = new RegExp(`\/dist\/(?!${options.name}$|${options.frontendProject}$).*$`);
  const ignoreExtraProjects: Array<RegExp> = getUnrelatedWorkspaceAppsIgnoreList(options);
  
  if (options.ignore) {
    if (options.ignore instanceof RegExp) {
      ignoreExtraProjects.push(options.ignore);
      options.ignore = ignoreExtraProjects;
    } else if (Array.isArray(options.ignore)) {
      options.ignore.concat(ignoreExtraProjects);
    }
  } else if (ignoreExtraProjects.length > 0) {
    options.ignore = ignoreExtraProjects;
  }

  return options;
}

function getUnrelatedWorkspaceAppsIgnoreList(options: PackageElectronBuilderOptions): Array<RegExp> {
  // get regex array of unrelated workspace apps (if exists) to be ignored
  let unrelatedAppsPaths: Array<RegExp> = [];
  const appsDir: string = 'apps';
  const appsPath: string = join(options.dir, appsDir); // assumes that apps is a super set of compiled apps (dist) 

  try {
    unrelatedAppsPaths = readdirSync(appsPath, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .filter(entry => entry.name !== options.name && entry.name !== options.frontendProject)
      .map(entry => new RegExp(appsDir + '/' + entry.name + '$')) // don't use join here
  } catch(error) {
    console.error(`${options.name} does not have a valid workspaceRoot. could not generate default ignore list.`);
  }

  return unrelatedAppsPaths;
}

function normalizeIgnoreOptions(options: PackageElectronBuilderOptions): PackageElectronBuilderOptions {
  // normalize ignore options (if exist) to be of type RegExp | RegExp[]
  let normalizedIgnoreOptions: Array<RegExp> = [];

  if (options.ignore) {
    if (typeof options.ignore === 'string') {
      options.ignore = new RegExp(options.ignore);
    } else if (typeof options.ignore === 'object' && options.ignore instanceof RegExp) {
      normalizedIgnoreOptions.push(options.ignore);
    } else if (Array.isArray(options.ignore)) {
      options.ignore.forEach(option => {
        if (typeof option === 'string') {
          option = new RegExp(option);
        } 
        
        if (option instanceof RegExp) {
          normalizedIgnoreOptions.push(option);
        }
      });

      options.ignore = normalizedIgnoreOptions;
    }
  }

  return options;
}

function addMissingDefaultOptions(options: PackageElectronBuilderOptions): PackageElectronBuilderOptions {
  //todo: add appVersion

  // remove unset options (use electron packager default where possible)
  Object.keys(options).forEach((key) => (options[key] === '') && delete options[key]);

  return options;
}

function removeSourceFiles(options: PackageElectronBuilderOptions, buildPath: string): Promise<any> {
  // remove source map files
  if (options['ignoreSourceMap']) {
    if (statSync(join(buildPath, 'dist')).isDirectory()) {
      try {
        removeSync(join(buildPath, 'dist', '**', '*.js.map'));
      } catch (error) {
        error('Failed to remove source map files:', error);
      }
    }
  }

  return new Promise((resolve, reject) => {
    // remove source files (./apps directory)
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
