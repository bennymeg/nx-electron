import { BuilderContext } from '@angular-devkit/architect';
import { workspaces, normalize } from '@angular-devkit/core';
import { NxScopedHost } from '@nrwl/devkit/ngcli-adapter';

export async function getSourceRoot(context: BuilderContext) {
  const workspaceHost = workspaces.createWorkspaceHost(new NxScopedHost(normalize(context.workspaceRoot)));
  const { workspace } = await workspaces.readWorkspace('', workspaceHost);
  
  if (workspace.projects.get(context.target.project).sourceRoot) {
    return workspace.projects.get(context.target.project).sourceRoot;
  } else {
    context.reportStatus('Error');
    const message = `${context.target.project} does not have a sourceRoot. Please define one.`;
    context.logger.error(message);
    throw new Error(message);
  }
}