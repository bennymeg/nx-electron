import { convertNxExecutor, ExecutorContext } from '@nrwl/devkit';

import executor from './executor';

function executorAdapter(options: any, context: ExecutorContext): 
    Promise<{ success: boolean; }> | AsyncIterableIterator<{ success: boolean; }> {
        return executor(options, context).toPromise()
            .then<any>(output => { success: output.success })
            .catch(error => { success: false });
}

export default convertNxExecutor(executorAdapter);