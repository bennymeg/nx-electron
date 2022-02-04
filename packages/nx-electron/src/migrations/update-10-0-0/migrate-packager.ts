import { chain, Rule } from '@angular-devkit/schematics';
import { formatFiles, updateWorkspaceInTree } from '@nrwl/workspace';

function updateConfigurations(): Rule {
  return updateWorkspaceInTree((workspaceJson) => {
    Object.entries<any>(workspaceJson.projects).forEach(
      ([projectName, project]) => {
        if (!project.architect) {
          return;
        }

        Object.entries<any>(project.architect).forEach(
          ([targetName, targetConfig]) => {
            if (targetConfig.builder === 'nx-electron:package') {
              const architect =
                workspaceJson.projects[projectName].architect[targetName];

              if (architect && architect.options) {
                architect.options.prepackageOnly = true;
                architect.options.outputPath = architect.options.out || "dist/packages";
                delete architect.options.out;
              }
            }

            if (targetConfig.builder === 'nx-electron:make') {
              const architect =
                workspaceJson.projects[projectName].architect[targetName];

              if (architect && architect.options) {
                architect.options.outputPath = architect.options.out || "dist/executables";
                delete architect.options.out;
              }
            }
          }
        );
      }
    );
    
    return workspaceJson;
  });
}

export default function update(): Rule {
  return chain([
    updateConfigurations(),
    formatFiles(),
  ]);
}