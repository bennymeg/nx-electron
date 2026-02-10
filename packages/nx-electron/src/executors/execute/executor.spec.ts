let buildOptions;

jest.mock('@nx/devkit');
const devkit = require('@nx/devkit');
import { ExecutorContext, logger } from '@nx/devkit';

jest.mock('child_process');
const { spawn } = require('child_process');

jest.mock('electron', () => '/mocked/electron');

jest.mock('tree-kill');
const treeKill = require('tree-kill');

import {
  executor,
  InspectType,
  ElectronExecuteBuilderOptions,
} from './executor';

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
      jest.requireActual('@nx/devkit').parseTargetString,
    );

    spawn.mockImplementation(() => {
      return {
        pid: 123,
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
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
      projectGraph: {
        nodes: {
          'electron-app': {
            name: 'electron-app',
            type: 'app',
            data: {
              root: '/root/electron-app',
              sourceRoot: '/root/electron-app/src',
            },
          },
          project1: {
            name: 'project1',
            type: 'app',
            data: { root: '/root/project1', sourceRoot: '/root/project1/src' },
          },
          project2: {
            name: 'project2',
            type: 'app',
            data: { root: '/root/project2', sourceRoot: '/root/project2/src' },
          },
        },
        dependencies: {},
      },
      projectsConfigurations: {
        version: 2,
        projects: {},
      },
      nxJsonConfiguration: {},
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
    expect(require('@nx/devkit').runExecutor).toHaveBeenCalledWith(
      {
        project: 'electron-app',
        target: 'build',
      },
      {
        testOption: true,
        generatePackageJson: false,
        watch: true,
      },
      context,
    );
    expect(spawn).toHaveBeenCalledWith(expect.any(String), [
      '--inspect=9229',
      'outfile.js',
    ]);
    expect(treeKill).toHaveBeenCalledTimes(0);
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  describe('--inspect', () => {
    describe('inspect', () => {
      it('should inspect the process', async () => {
        for await (const event of executor(
          {
            ...options,
            inspect: InspectType.Inspect,
          },
          context,
        )) {
        }
        expect(spawn).toHaveBeenCalledWith(expect.any(String), [
          '--inspect=9229',
          'outfile.js',
        ]);
      });
    });

    describe('inspect-brk', () => {
      it('should inspect and break at beginning of execution', async () => {
        for await (const event of executor(
          {
            ...options,
            inspect: InspectType.InspectBrk,
          },
          context,
        )) {
        }
        expect(spawn).toHaveBeenCalledWith(expect.any(String), [
          '--inspect-brk=9229',
          'outfile.js',
        ]);
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
          context,
        )) {
        }
        expect(spawn).toHaveBeenCalledWith(expect.any(String), [
          '--inspect=1234',
          'outfile.js',
        ]);
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
      context,
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
      context,
    )) {
    }
    expect(spawn).toHaveBeenCalledWith(expect.any(String), [
      'outfile.js',
      'arg1',
      'arg2',
    ]);
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
      context,
    )) {
    }
    expect(loggerWarn).toHaveBeenCalled();
  });

  describe('waitUntilTasks', () => {
    it('should run the tasks before starting the build', async () => {
      const runExecutor = require('@nx/devkit').runExecutor;
      for await (const event of executor(
        {
          ...options,
          waitUntilTargets: ['project1:target1', 'project2:target2'],
        },
        context,
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
        context,
      );
      expect(runExecutor).toHaveBeenCalledWith(
        {
          project: 'project2',
          target: 'target2',
        },
        {},
        context,
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
          context,
        )) {
        }
      } catch (e) {
        expect(e.message).toMatchInlineSnapshot(
          `"Wait until target failed: project1:target1."`,
        );
      }
    });
  });
});
