import { Linter } from '@nx/eslint';

export interface Schema {
  name: string;
  frontendProject?: string;
  addProxy: boolean;
  proxyPort: number;
  skipFormat: boolean;
  skipPackageJson: boolean;
  directory?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
  tags?: string;
  setParserOptionsProject?: boolean;
}
