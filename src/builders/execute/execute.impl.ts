import { BuilderContext, createBuilder, BuilderOutput, targetFromTargetString, scheduleTargetAndForget } from '@angular-devkit/architect';
import { ChildProcess, spawn } from 'child_process';
import electron from 'electron';
import * as treeKill from 'tree-kill';

import { Observable, bindCallback, of, zip, from } from 'rxjs';
import { concatMap, tap, mapTo, first, map, filter } from 'rxjs/operators';

import { ElectronBuildEvent } from '../build/build.impl';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { JsonObject } from '@angular-devkit/core';

try {
  require('dotenv').config();
} catch (e) {}

export const enum InspectType {
  Inspect = 'inspect',
  InspectBrk = 'inspect-brk',
  InspectBrkNode = 'inspect-brk-node',
  //InspectBrkElectron = 'inspect-brk-electron'
}

export interface ElectronExecuteBuilderOptions extends JsonObject {
  inspect: boolean | InspectType;
  port: number;
  args: string[];
  waitUntilTargets: string[];
  buildTarget: string;
}

export default createBuilder<ElectronExecuteBuilderOptions>(
  electronExecuteBuilderHandler
);

let subProcess: ChildProcess;

export function electronExecuteBuilderHandler(options: ElectronExecuteBuilderOptions, context: BuilderContext): Observable<BuilderOutput> {
  return runWaitUntilTargets(options, context).pipe(
    concatMap(v => {
      if (!v.success) {
        context.logger.error(
          `One of the tasks specified in waitUntilTargets failed`
        );
        return of({ success: false });
      }

      return startBuild(options, context).pipe(
        concatMap((event: ElectronBuildEvent) => {
          if (event.success) {
            return restartProcess(event.outfile, options, context).pipe(
              mapTo(event)
            );
          } else {
            context.logger.error(
              'There was an error with the build. See above.'
            );
            context.logger.info(`${event.outfile} was not restarted.`);
            return of(event);
          }
        })
      );
    })
  );
}

function runProcess(file: string, options: ElectronExecuteBuilderOptions) {
  if (subProcess) {
    throw new Error('Already running');
  }

  subProcess = spawn(String(electron), normalizeArgs(file, options));
}

function normalizeArgs(file: string, options: ElectronExecuteBuilderOptions) {
  const args = [];

  if (options.inspect === true) {
    options.inspect = InspectType.Inspect;
  }

  if (options.inspect) {
    args.push(`--${options.inspect}=${options.port}`);
  }

  args.push(file);
  args.concat(options.args);

  return args;
}

function restartProcess(file: string, options: ElectronExecuteBuilderOptions, context: BuilderContext) {
  return killProcess(context).pipe(
    tap(() => {
      runProcess(file, options);
    })
  );
}

function killProcess(context: BuilderContext): Observable<void | Error> {
  if (!subProcess) {
    return of(undefined);
  }

  const observableTreeKill = bindCallback<number, string, Error>(treeKill);
  return observableTreeKill(subProcess.pid, 'SIGTERM').pipe(
    tap(error => {
      subProcess = null;

      if (error) {
        if (Array.isArray(error) && error[0] && error[2]) {
          const errorMessage = error[2];
          context.logger.error(errorMessage);
        } else if (error.message) {
          context.logger.error(error.message);
        }
      }
    })
  );
}

function startBuild(options: ElectronExecuteBuilderOptions, context: BuilderContext): Observable<ElectronBuildEvent> {
  const target = targetFromTargetString(options.buildTarget);

  return from(
    Promise.all([
      context.getTargetOptions(target),
      context.getBuilderNameForTarget(target)
    ]).then(([options, builderName]) =>
      context.validateOptions(options, builderName)
    )
  ).pipe(
    tap(options => {
      if (options.optimization) {
        context.logger.warn(stripIndents`
            ************************************************
            This is a simple process manager for use in
            testing or debugging Electron applications locally.
            DO NOT USE IT FOR PRODUCTION!
            You should look into proper means of deploying
            your electron application to production.
            ************************************************`);
      }
    }),
    concatMap(
      () =>
        scheduleTargetAndForget(context, target, {
          watch: true
        }) as Observable<ElectronBuildEvent>
    )
  );
}

function runWaitUntilTargets(options: ElectronExecuteBuilderOptions, context: BuilderContext): Observable<BuilderOutput> {
  if (!options.waitUntilTargets || options.waitUntilTargets.length === 0) {
    return of({ success: true });
  }

  return zip(
    ...options.waitUntilTargets.map(b => {
      return scheduleTargetAndForget(context, targetFromTargetString(b)).pipe(
        filter(e => e.success !== undefined),
        first()
      );
    })
  ).pipe(
    map(results => {
      return { success: !results.some(r => !r.success) };
    })
  );
}
