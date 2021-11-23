import { normalizeBuildOptions } from './normalize';
import { BuildElectronBuilderOptions } from '../executors/build/executor';
import * as fs from 'fs';

describe('normalizeBuildOptions', () => {
  let options: BuildElectronBuilderOptions;
  let root: string;
  let sourceRoot: string;
  let projectRoot: string;

  beforeEach(() => {
    options = {
      main: 'apps/electron-app/src/main.ts',
      tsConfig: 'apps/electron-app/tsconfig.app.json',
      outputPath: 'dist/apps/electron-app',
      implicitDependencies: [],
      fileReplacements: [
        {
          replace: 'apps/environment/environment.ts',
          with: 'apps/environment/environment.prod.ts',
        },
        {
          replace: 'module1.ts',
          with: 'module2.ts',
        },
      ],
      assets: [],
      statsJson: false,
      externalDependencies: 'all',
    };
    root = '/root';
    sourceRoot = 'apps/electron-app/src';
    projectRoot = 'apps/electron-app';
  });

  it('should add the root', () => {
    const result = normalizeBuildOptions(
      options,
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.root).toEqual('/root');
  });

  it('should resolve main from root', () => {
    const result = normalizeBuildOptions(
      options,
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.main).toEqual('/root/apps/electron-app/src/main.ts');
  });

  it('should resolve additional entries from root', () => {
    const result = normalizeBuildOptions(
      {
        ...options,
        additionalEntryPoints: [
          { entryName: 'test', entryPath: 'some/path.ts' },
        ],
      },
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.additionalEntryPoints[0].entryPath).toEqual(
      '/root/some/path.ts'
    );
  });

  it('should resolve the output path', () => {
    const result = normalizeBuildOptions(
      options,
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.outputPath).toEqual('/root/dist/apps/electron-app');
  });

  it('should resolve the tsConfig path', () => {
    const result = normalizeBuildOptions(
      options,
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.tsConfig).toEqual('/root/apps/electron-app/tsconfig.app.json');
  });

  it('should normalize asset patterns', () => {
    jest.spyOn(fs, 'statSync').mockReturnValue({
      isDirectory: () => true,
    } as any);
    const result = normalizeBuildOptions(
      {
        ...options,
        root,
        assets: [
          'apps/electron-app/src/assets',
          {
            input: 'outsideproj',
            output: 'output',
            glob: '**/*',
            ignore: ['**/*.json'],
          },
        ],
      },
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.assets).toEqual([
      {
        input: '/root/apps/electron-app/src/assets',
        output: 'assets',
        glob: '**/*',
      },
      {
        input: '/root/outsideproj',
        output: 'output',
        glob: '**/*',
        ignore: ['**/*.json'],
      },
    ]);
  });

  it('should resolve the file replacement paths', () => {
    const result = normalizeBuildOptions(
      options,
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.fileReplacements).toEqual([
      {
        replace: '/root/apps/environment/environment.ts',
        with: '/root/apps/environment/environment.prod.ts',
      },
      {
        replace: '/root/module1.ts',
        with: '/root/module2.ts',
      },
    ]);
  });

  it('should resolve outputFileName correctly', () => {
    const result = normalizeBuildOptions(
      options,
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.outputFileName).toEqual('main.js');
  });

  it('should resolve outputFileName to "main.js" if not passed in', () => {
    const result = normalizeBuildOptions(
      { ...options, outputFileName: 'index.js' },
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.outputFileName).toEqual('index.js');
  });
});
