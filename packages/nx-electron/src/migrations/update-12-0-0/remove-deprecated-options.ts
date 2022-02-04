import { formatFiles, getProjects, logger, Tree, updateProjectConfiguration } from '@nrwl/devkit';

export default async function update(host: Tree) {
  const projects = getProjects(host);

  for (const [name, config] of projects.entries()) {
    if (config.targets.build.executor !== 'nx-electron:build') return;

    let updated = false;

    if (
      typeof config.targets.build?.configurations?.production?.[
        'showCircularDependencies'
      ] !== 'undefined'
    ) {
      delete config.targets.build.configurations.production[
        'showCircularDependencies'
      ];
      updated = true;
    }

    if (
      typeof config.targets.build?.options?.['showCircularDependencies'] !==
      'undefined'
    ) {
      delete config.targets.build.options['showCircularDependencies'];
      updated = true;
    }

    if (updated) {
      updateProjectConfiguration(host, name, config);
      logger.info(
        `nx-electron removed legacy build option from "${name}": showCircularDependencies`
      );
    }
  }

  await formatFiles(host);
}
