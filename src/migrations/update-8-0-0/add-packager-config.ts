import { chain, Rule, Tree } from '@angular-devkit/schematics';
import { formatFiles, updateWorkspaceInTree } from '@nrwl/workspace';
import { resolve } from 'path';

function addConfigurations(): Rule {
  return updateWorkspaceInTree((workspaceJson) => {
    Object.entries<any>(workspaceJson.projects).forEach(
      ([projectName, project]) => {
        if (!project.architect) {
          return;
        }

        Object.entries<any>(project.architect).forEach(
          ([targetName, targetConfig]) => {
            if (targetConfig.builder === 'nx-electron:build') {
              const project = workspaceJson.projects[projectName];
              let frontendProject = "{replace with frontend-app-name}";

              project.architect['make'] = {
                "builder": "nx-electron:make",
                "options": {
                    "name": projectName,
                    "frontendProject": frontendProject,
                    "out": "dist/executables"
                }
              };
            }
          }
        );
      }
    );

    return workspaceJson;
  });
}

function addConfigurationFile(): Rule {
  let rules: Rule[] = [];

  updateWorkspaceInTree((workspaceJson) => {
    Object.entries<any>(workspaceJson.projects).forEach(
      ([projectName, project]) => {
        if (project.architect) {

          Object.entries<any>(project.architect).forEach(
            ([targetName, targetConfig]) => {
              if (targetConfig.builder === 'nx-electron:build') {
                const project = workspaceJson.projects[projectName];
                rules.push(writeConfigurationFile(project.sourceRoot));
              }
            }
          );
        }
      }
    );
  });

  return chain(rules); 
}

function writeConfigurationFile(projectSourceRoot: string): Rule {
  return (host: Tree) => {
    host.overwrite(
      resolve(projectSourceRoot, 'app/options/packager.options'),
`{
  "$schema": "../../../../../node_modules/nx-electron/src/validation/packager.schema.json"
}
`
    );
  };
}

export default function update(): Rule {
  return chain([
    addConfigurations(),
    addConfigurationFile(),
    formatFiles(),
  ]);
}