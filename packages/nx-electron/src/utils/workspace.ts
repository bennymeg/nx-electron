import { ExecutorContext } from '@nx/devkit';

export function getSourceRoot(context: ExecutorContext): {
  sourceRoot: string;
  projectRoot: string;
} {
  const { sourceRoot, root } = context.projectsConfigurations.projects[context.projectName];

  if (sourceRoot && root) {
    return { sourceRoot, projectRoot: root };
  }

  throw new Error(
    'Project does not have a sourceRoot or root. Please define both.'
  );
}
