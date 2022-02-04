import { convertNxExecutor, ExecutorContext } from '@nrwl/devkit';

import executor from './executor';

function executorAdapter(options: any, context: ExecutorContext): 
    Promise<{ success: boolean; }> | AsyncIterableIterator<{ success: boolean; }> {
        return executor(options, context);
}

export default convertNxExecutor(executorAdapter);