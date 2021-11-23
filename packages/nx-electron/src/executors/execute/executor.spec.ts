let buildOptions;

jest.mock('@nrwl/devkit');
const devkit = require('@nrwl/devkit');
import { ExecutorContext, logger } from '@nrwl/devkit';

jest.mock('child_process');
let { fork } = require('child_process');

jest.mock('tree-kill');
let treeKill = require('tree-kill');

import { executor, InspectType, ElectronExecuteBuilderOptions } from './executor';

describe('ElectronExecuteBuilder', () => {
  let options: ElectronExecuteBuilderOptions;
  let context: ExecutorContext;

  beforeEach(async () => {
    buildOptions = {};

    (devkit.runExecutor as any).mockImplementation(function* () {
      yield { success: true, outfile: 'outfile.js' };
    });

    (devkit.readTargetOptions as any).mockImplementation(() => buildOptions);

    (devkit.parseTargetString as any).mockImplementation(
      jest.requireActual('@nrwl/devkit').parseTargetString
    );

    fork.mockImplementation(() => {
      return {
        on: (eventName, cb) => {
          if (eventName === 'exit') {
            cb();
          }
        },
      };
    });

    treeKill.mockImplementation((pid, signal, callback) => {
      callback();
    });
    context = {
      root: '/root',
      cwd: '/root',
      workspace: {
        version: 2,
        projects: {
          'electron-app': {
            root: '/root/electron-app',
            targets: {
              build: {
                executor: 'build',
                options: {},
              },
            },
          },
        },
      },
      isVerbose: false,
    };

    options = {
      inspect: true,
      args: [],
      buildTarget: 'electron-app:build',
      buildTargetOptions: { testOption: true },
      port: 9229,
      waitUntilTargets: [],
      watch: true,
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should build the application and start the built file', async () => {
    for await (const event of executor(options, context)) {
      expect(event.success).toEqual(true);
    }
    expect(require('@nrwl/devkit').runExecutor).toHaveBeenCalledWith(
      {
        project: 'electron-app',
        target: 'build',
      },
      {
        testOption: true,
        watch: true,
      },
      context
    );
    expect(fork).toHaveBeenCalledWith('outfile.js', [], {
      execArgv: [
        '--inspect=9229',
      ],
    });
    expect(treeKill).toHaveBeenCalledTimes(0);
    expect(fork).toHaveBeenCalledTimes(1);
  });

  describe('--inspect', () => {
    describe('inspect', () => {
      it('should inspect the process', async () => {
        for await (const event of executor(
          {
            ...options,
            inspect: InspectType.Inspect,
          },
          context
        )) {
        }
        expect(fork).toHaveBeenCalledWith('outfile.js', [], {
          execArgv: [
            '--inspect=9229',
          ],
        });
      });
    });

    describe('inspect-brk', () => {
      it('should inspect and break at beginning of execution', async () => {
        for await (const event of executor(
          {
            ...options,
            inspect: InspectType.InspectBrk,
          },
          context
        )) {
        }
        expect(fork).toHaveBeenCalledWith('outfile.js', [], {
          execArgv: [
            '--inspect-brk=9229',
          ],
        });
      });
    });
  });

  describe('--port', () => {
    describe('1234', () => {
      it('should inspect the process on port 1234', async () => {
        for await (const event of executor(
          {
            ...options,
            port: 1234,
          },
          context
        )) {
        }
        expect(fork).toHaveBeenCalledWith('outfile.js', [], {
          execArgv: [
            '--inspect=1234',
          ],
        });
      });
    });
  });

  it('should log errors from killing the process', async () => {
    treeKill.mockImplementation((pid, signal, callback) => {
      callback(new Error('Error Message'));
    });

    const loggerError = jest.spyOn(logger, 'error');

    for await (const event of executor(options, context)) {
    }
    expect(loggerError).toHaveBeenCalledWith('Error Message');
  });

  it('should log errors from killing the process on windows', async () => {
    treeKill.mockImplementation((pid, signal, callback) => {
      callback([new Error('error'), '', 'Error Message']);
    });

    const loggerError = jest.spyOn(logger, 'error');

    for await (const event of executor(
      {
        ...options,
      },
      context
    )) {
    }
    expect(loggerError).toHaveBeenLastCalledWith('Error Message');
  });

  it('should build the application and start the built file with options', async () => {
    for await (const event of executor(
      {
        ...options,
        inspect: false,
        args: ['arg1', 'arg2'],
      },
      context
    )) {
    }
    expect(fork).toHaveBeenCalledWith('outfile.js', ['arg1', 'arg2'], {});
  });

  it('should warn users who try to use it in production', async () => {
    buildOptions = {
      optimization: true,
    };
    const loggerWarn = jest.spyOn(logger, 'warn');
    for await (const event of executor(
      {
        ...options,
        inspect: false,
        args: ['arg1', 'arg2'],
      },
      context
    )) {
    }
    expect(loggerWarn).toHaveBeenCalled();
  });

  describe('waitUntilTasks', () => {
    it('should run the tasks before starting the build', async () => {
      const runExecutor = require('@nrwl/devkit').runExecutor;
      for await (const event of executor(
        {
          ...options,
          waitUntilTargets: ['project1:target1', 'project2:target2'],
        },
        context
      )) {
      }

      expect(runExecutor).toHaveBeenCalledTimes(3);
      expect(runExecutor).toHaveBeenNthCalledWith(
        1,
        {
          project: 'project1',
          target: 'target1',
        },
        {},
        context
      );
      expect(runExecutor).toHaveBeenCalledWith(
        {
          project: 'project2',
          target: 'target2',
        },
        {},
        context
      );
    });

    it('should not run the build if any of the tasks fail', async () => {
      devkit.runExecutor.mockImplementation(function* () {
        yield { success: false };
      });

      try {
        for await (const event of executor(
          {
            ...options,
            waitUntilTargets: ['project1:target1', 'project2:target2'],
          },
          context
        )) {
        }
      } catch (e) {
        expect(e.message).toMatchInlineSnapshot(
          `"Wait until target failed: project1:target1."`
        );
      }
    });
  });
});
