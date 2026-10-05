import { readFileSync } from 'fs';
import { dirname, join } from 'path';

// Nx Console and `nx g --help` render generators and executors from these schemas.
const packageRoot = join(__dirname, '..');

function readJsonFile(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function schemasOf(collectionFile: string, key: 'generators' | 'executors') {
  const collection = readJsonFile(join(packageRoot, collectionFile))[key];
  return Object.entries<{ schema: string }>(collection).map(
    ([name, { schema }]) => ({
      name,
      file: schema,
      schema: readJsonFile(join(packageRoot, dirname(collectionFile), schema)),
    }),
  );
}

const schemas = [
  ...schemasOf('generators.json', 'generators'),
  ...schemasOf('executors.json', 'executors'),
];

function property(file: string, name: string) {
  return schemas.find((s) => s.file === file).schema.properties[name];
}

const generatorSchema = './src/generators/nx-electron/schema.json';
const buildSchema = './src/executors/build/schema.json';
const packageSchema = './src/executors/package/schema.json';

describe('schemas', () => {
  describe.each(schemas)('$name ($file)', ({ schema }) => {
    it('should describe every option and give it a type', () => {
      const incomplete = Object.entries<Record<string, unknown>>(
        schema.properties,
      )
        .filter(
          ([, option]) =>
            !option.description ||
            !(option.type || option.oneOf || option.anyOf),
        )
        .map(([name]) => name);

      expect(incomplete).toEqual([]);
    });

    it('should not refer to angular.json', () => {
      expect(JSON.stringify(schema)).not.toContain('angular.json');
    });
  });

  it('should describe the application generator', () => {
    expect(
      schemas.find((s) => s.file === generatorSchema).schema.description,
    ).toBeTruthy();
  });

  it('should offer a project dropdown for the frontend project', () => {
    expect(property(generatorSchema, 'frontendProject')['x-dropdown']).toBe(
      'projects',
    );
  });

  it('should allow to generate without a linter', () => {
    expect(property(generatorSchema, 'linter').enum).toEqual([
      'eslint',
      'none',
    ]);
  });

  it.each([
    [generatorSchema, 'extraProjects'],
    [buildSchema, 'statsJson'],
    [buildSchema, 'implicitDependencies'],
  ])('should mark the unused option %s > %s as deprecated', (file, name) => {
    expect(property(file, name)['x-deprecated']).toBeTruthy();
  });

  it.each(['additionalEntryPoints', 'outputFileName'])(
    'should document the build option %s',
    (name) => {
      expect(property(buildSchema, name)).toBeDefined();
    },
  );

  it('should explain what sourcePath is still used for', () => {
    expect(property(packageSchema, 'sourcePath').description).toContain(
      'frontendProject',
    );
  });
});
