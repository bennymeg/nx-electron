import { InspectType, ElectronExecuteBuilderOptions, electronExecuteBuilderHandler } from './execute.impl';
import { of, from } from 'rxjs';
import * as devkitArchitect from '@angular-devkit/architect';
import { MockBuilderContext, getMockContext } from '../../utils/testing';

jest.mock('child_process');
let { fork } = require('child_process');
jest.mock('tree-kill');
let treeKill = require('tree-kill');

describe('ElectronExecuteBuilder', () => {
  let testOptions: ElectronExecuteBuilderOptions;
  let context: MockBuilderContext;
  let scheduleTargetAndForget: jasmine.Spy;

  beforeEach(async () => {
    fork.mockReturnValue({
      pid: 123
    });
    treeKill.mockImplementation((pid, signal, callback) => {
      callback();
    });
    context = await getMockContext();
    context.addTarget(
      {
        project: 'electronapp',
        target: 'build'
      },
      'nx-electron:build'
    );
    testOptions = {
      inspect: true,
      args: [],
      buildTarget: 'electronapp:build',
      port: 9229,
      waitUntilTargets: [],
      host: 'localhost'
    };
    scheduleTargetAndForget = spyOn(
      devkitArchitect,
      'scheduleTargetAndForget'
    ).and.returnValue(of({ success: true, outfile: 'outfile.js' }));
  });

  it('should build the application and start the built file', async () => {
    await electronExecuteBuilderHandler(testOptions, context).toPromise();

    expect(scheduleTargetAndForget).toHaveBeenCalledWith(
      context,
      {
        project: 'electronapp',
        target: 'build'
      },
      {
        watch: true
      }
    );
    expect(fork).toHaveBeenCalledWith('outfile.js', [], {
      execArgv: [
        '-r',
        'source-map-support/register',
        '--inspect=localhost:9229'
      ]
    });
    expect(treeKill).toHaveBeenCalledTimes(0);
    expect(fork).toHaveBeenCalledTimes(1);
  });

  describe('--inspect', () => {
    describe('inspect', () => {
      it('should inspect the process', async () => {
        await electronExecuteBuilderHandler(
          {
            ...testOptions,
            inspect: InspectType.Inspect
          },
          context
        ).toPromise();
        expect(fork).toHaveBeenCalledWith('outfile.js', [], {
          execArgv: [
            '-r',
            'source-map-support/register',
            '--inspect=localhost:9229'
          ]
        });
      });
    });

    describe('inspect-brk', () => {
      it('should inspect and break at beginning of execution', async () => {
        await electronExecuteBuilderHandler(
          {
            ...testOptions,
            inspect: InspectType.InspectBrk
          },
          context
        ).toPromise();
        expect(fork).toHaveBeenCalledWith('outfile.js', [], {
          execArgv: [
            '-r',
            'source-map-support/register',
            '--inspect=localhost:9229'
          ]
        });
      });
    });
  });

  describe('--host', () => {
    describe('0.0.0.0', () => {
      it('should inspect the process on host 0.0.0.0', async () => {
        await electronExecuteBuilderHandler(
          {
            ...testOptions,
            host: '0.0.0.0'
          },
          context
        ).toPromise();
        expect(fork).toHaveBeenCalledWith('outfile.js', [], {
          execArgv: [
            '-r',
            'source-map-support/register',
            '--inspect=localhost:9229'
          ]
        });
      });
    });
  });

  describe('--port', () => {
    describe('1234', () => {
      it('should inspect the process on port 1234', async () => {
        await electronExecuteBuilderHandler(
          {
            ...testOptions,
            port: 1234
          },
          context
        ).toPromise();
        expect(fork).toHaveBeenCalledWith('outfile.js', [], {
          execArgv: [
            '-r',
            'source-map-support/register',
            '--inspect=localhost:1234'
          ]
        });
      });
    });
  });

  it('should log errors from killing the process', async done => {
    treeKill.mockImplementation((pid, signal, callback) => {
      callback(new Error('Error Message'));
    });
    const loggerError = spyOn(context.logger, 'error');
    scheduleTargetAndForget = scheduleTargetAndForget.and.returnValue(
      from([
        { success: true, outfile: 'outfile.js' },
        { success: true, outfile: 'outfile.js' }
      ])
    );
    electronExecuteBuilderHandler(testOptions, context).subscribe({
      complete: () => {
        expect(loggerError.calls.argsFor(1)).toEqual(['Error Message']);
        done();
      }
    });
  });

  it('should log errors from killing the process on windows', async () => {
    treeKill.mockImplementation((pid, signal, callback) => {
      callback([new Error('error'), '', 'Error Message']);
    });
    const loggerError = spyOn(context.logger, 'error');
    scheduleTargetAndForget = scheduleTargetAndForget.and.returnValue(
      from([
        { success: true, outfile: 'outfile.js' },
        { success: true, outfile: 'outfile.js' }
      ])
    );
    await electronExecuteBuilderHandler(testOptions, context).toPromise();
    expect(loggerError.calls.argsFor(1)).toEqual(['Error Message']);
  });

  it('should build the application and start the built file with options', async () => {
    await electronExecuteBuilderHandler(
      {
        ...testOptions,
        inspect: false,
        args: ['arg1', 'arg2']
      },
      context
    ).toPromise();
    expect(fork).toHaveBeenCalledWith('outfile.js', ['arg1', 'arg2'], {
      execArgv: ['-r', 'source-map-support/register']
    });
  });

  it('should warn users who try to use it in production', async () => {
    spyOn(context, 'validateOptions').and.returnValue(
      Promise.resolve({
        optimization: true
      })
    );
    spyOn(context.logger, 'warn');
    await electronExecuteBuilderHandler(testOptions, context).toPromise();
    expect(context.logger.warn).toHaveBeenCalled();
  });

  describe('waitUntilTasks', () => {
    it('should run the tasks before starting the build', async () => {
      scheduleTargetAndForget = scheduleTargetAndForget.and.returnValue(
        of({ success: true })
      );
      await electronExecuteBuilderHandler(
        {
          ...testOptions,
          waitUntilTargets: ['project1:target1', 'project2:target2']
        },
        context
      ).toPromise();

      expect(scheduleTargetAndForget).toHaveBeenCalledTimes(3);
      expect(scheduleTargetAndForget).toHaveBeenCalledWith(context, {
        project: 'project1',
        target: 'target1'
      });
      expect(scheduleTargetAndForget).toHaveBeenCalledWith(context, {
        project: 'project2',
        target: 'target2'
      });
    });

    it('should not run the build if any of the tasks fail', async () => {
      scheduleTargetAndForget = scheduleTargetAndForget.and.callFake(target =>
        of({ success: target.target === 'project1' })
      );
      const loggerError = spyOn(context.logger, 'error');

      const output = await electronExecuteBuilderHandler(
        {
          ...testOptions,
          waitUntilTargets: ['project1:target1', 'project2:target2']
        },
        context
      ).toPromise();
      expect(output).toEqual(
        jasmine.objectContaining({
          success: false
        })
      );
      expect(loggerError).toHaveBeenCalled();
    });
  });
});
