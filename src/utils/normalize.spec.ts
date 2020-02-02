import { normalizeBuildOptions } from './normalize';
import { BuildBuilderOptions } from './types';
import { Path, normalize } from '@angular-devkit/core';

import * as fs from 'fs';

describe('normalizeBuildOptions', () => {
  let testOptions: BuildBuilderOptions;
  let root: string;
  let sourceRoot: Path;

  beforeEach(() => {
    testOptions = {
      main: 'apps\\electronapp\\src\\main.ts',
      tsConfig: 'apps\\electronapp\\tsconfig.app.json',
      outputPath: 'dist\\apps\\electronapp',
      fileReplacements: [
        {
          replace: 'apps\\environment\\environment.ts',
          with: 'apps\\environment\\environment.prod.ts'
        },
        {
          replace: 'module1.ts',
          with: 'module2.ts'
        }
      ],
      assets: [],
      statsJson: false
    };
    root = 'C:\\root';
    sourceRoot = normalize('apps\\electronapp\\src');
  });
  it('should add the root', () => {
    const result = normalizeBuildOptions(testOptions, root, sourceRoot);
    expect(result.root).toEqual('C:\\root');
  });

  it('should resolve main from root', () => {
    const result = normalizeBuildOptions(testOptions, root, sourceRoot);
    expect(result.main).toEqual('C:\\root\\apps\\electronapp\\src\\main.ts');
  });

  it('should resolve the output path', () => {
    const result = normalizeBuildOptions(testOptions, root, sourceRoot);
    expect(result.outputPath).toEqual('C:\\root\\dist\\apps\\electronapp');
  });

  it('should resolve the tsConfig path', () => {
    const result = normalizeBuildOptions(testOptions, root, sourceRoot);
    expect(result.tsConfig).toEqual('C:\\root\\apps\\electronapp\\tsconfig.app.json');
  });

  it('should normalize asset patterns', () => {
    spyOn(fs, 'statSync').and.returnValue({
      isDirectory: () => true
    });
    const result = normalizeBuildOptions(
      <BuildBuilderOptions>{
        ...testOptions,
        root,
        assets: [
          'apps\\electronapp\\src\\assets',
          {
            input: 'outsideproj',
            output: 'output',
            glob: '**\\*',
            ignore: ['**\\*.json']
          }
        ]
      },
      root,
      sourceRoot
    );
    expect(result.assets).toEqual([
      {
        input: 'C:\\root\\apps\\electronapp\\src\\assets',
        output: 'assets',
        glob: '**\\*'
      },
      {
        input: 'C:\\root\\outsideproj',
        output: 'output',
        glob: '**\\*',
        ignore: ['**\\*.json']
      }
    ]);
  });

  it('should resolve the file replacement paths', () => {
    const result = normalizeBuildOptions(testOptions, root, sourceRoot);
    expect(result.fileReplacements).toEqual([
      {
        replace: 'C:\\root\\apps\\environment\\environment.ts',
        with: 'C:\\root\\apps\\environment\\environment.prod.ts'
      },
      {
        replace: 'C:\\root\\module1.ts',
        with: 'C:\\root\\module2.ts'
      }
    ]);
  });
});
