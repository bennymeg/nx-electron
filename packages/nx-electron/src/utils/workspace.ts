import {
  ExecutorContext,
  readProjectsConfigurationFromProjectGraph,
} from '@nx/devkit';

export function getSourceRoot(context: ExecutorContext): {
  sourceRoot: string;
  projectRoot: string;
} {
  const projectName = context.projectName;
  if (!projectName) {
    throw new Error('Executor context does not have a project name.');
  }

  if (!context.projectGraph) {
    throw new Error('Executor context does not include a project graph.');
  }

  const { projects } = readProjectsConfigurationFromProjectGraph(
    context.projectGraph,
  );
  const { sourceRoot, root } = projects[projectName] ?? {};

  if (sourceRoot && root) {
    return { sourceRoot, projectRoot: root };
  }

  throw new Error(
    'Project does not have a sourceRoot or root. Please define both.',
  );
}
