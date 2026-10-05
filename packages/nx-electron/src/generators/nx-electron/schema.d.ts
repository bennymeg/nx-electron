import { Linter } from '@nx/eslint';

export interface Schema {
  directory: string;
  name?: string;
  frontendProject?: string;
  addProxy: boolean;
  proxyPort: number;
  skipFormat: boolean;
  skipPackageJson: boolean;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
  tags?: string;
  setParserOptionsProject?: boolean;
  useProjectJson?: boolean;
}
