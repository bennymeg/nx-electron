import { readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import subject from './remove-deprecated-options';

describe('Migration: Remove deprecated options', () => {
  it(`should remove deprecated node build options`, async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write(
      'project.json',
      JSON.stringify({
        name: 'electron-app',
        sourceRoot: 'apps/myapp/src',
        projectType: 'application',
        targets: {
          build: {
            executor: 'nx-electron:build',
            options: {
              showCircularDependencies: false,
            },
            configurations: {
              production: {
                showCircularDependencies: true,
              },
            },
          },
        },
      })
    );

    await subject(tree);

    expect(readJson(tree, 'project.json')).toEqual({
      $schema: 'node_modules/nx/schemas/project-schema.json',
      name: 'electron-app',
      sourceRoot: 'apps/myapp/src',
      projectType: 'application',
      targets: {
        build: {
          executor: 'nx-electron:build',
          options: {},
          configurations: {
            production: {},
          },
        },
      },
    });
  });
});
