import {
  ExecutorContext,
  joinPathFragments,
  readProjectsConfigurationFromProjectGraph,
} from '@nx/devkit';
import { existsSync } from 'fs';
import { join } from 'path';

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

  if (!root) {
    throw new Error('Project does not have a root. Please define it.');
  }

  if (sourceRoot) {
    return { sourceRoot, projectRoot: root };
  }

  // Projects configured in package.json (the TS solution setup) usually have no
  // sourceRoot. Fall back like Nx does (`getProjectSourceRoot` in @nx/js).
  const srcFolder = joinPathFragments(root, 'src');
  return {
    sourceRoot: existsSync(join(context.root, srcFolder)) ? srcFolder : root,
    projectRoot: root,
  };
}
