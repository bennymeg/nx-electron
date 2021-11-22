import { BuilderContext } from '@angular-devkit/architect';
import { workspaces, normalize } from '@angular-devkit/core';
import { NxScopedHost } from '@nrwl/devkit/ngcli-adapter';

export async function getSourceRoot(context: BuilderContext): Promise<{ sourceRoot: string; projectRoot: string }> {
  const workspaceHost = workspaces.createWorkspaceHost(new NxScopedHost(normalize(context.workspaceRoot)));
  const { workspace } = await workspaces.readWorkspace('', workspaceHost);
  const { project } = context.target;
  const { sourceRoot, root } = workspace.projects.get(project);

  if (sourceRoot && root) {
    return { sourceRoot, projectRoot: root };
  }
  
  context.reportStatus('Error');
  const message = `${project} does not have a sourceRoot or root. Please define both.`;
  context.logger.error(message);
  throw new Error(message);
}