import { ExecutorContext } from '@nrwl/devkit';
import { join } from 'path';
import { mocked } from 'ts-jest/utils';
import { executor, PackageElectronBuilderOptions } from './executor';

jest.mock('@nrwl/workspace/src/core/project-graph');
import * as projectGraph from '@nrwl/workspace/src/core/project-graph';
import { ProjectGraph, ProjectType } from '@nrwl/workspace/src/core/project-graph';

jest.mock('glob');
import * as glob from 'glob';

jest.mock('fs-extra');
import * as fs from 'fs-extra';

jest.mock('@nrwl/workspace/src/utilities/fileutils');
import * as fsUtility from '@nrwl/workspace/src/utilities/fileutils';
import * as tsUtils from '@nrwl/workspace/src/utilities/typescript';
import * as ts from 'typescript';

describe('MakeElectronBuilder', () => {
  let context: ExecutorContext;
  let options: PackageElectronBuilderOptions;

  beforeEach(async () => {

    options = {
      root: '.',
      platform: 'windows',
      arch: 'x64',
      asar: true,
      name: 'electron-app',
      frontendProject: 'frontend',
      prepackageOnly: false,
      sourcePath: 'dist/apps',
      outputPath: 'dist/packages',
    };
  });

  describe('run', () => {
    it('should find a way to test application packaging', async () => {
      expect(true).toEqual(true);
    });
  });
});
