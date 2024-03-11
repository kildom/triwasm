
import { Path } from '../common/path';
import { parse } from '../common/argparse';
import { platform } from '../common/platform';
import { ARGS_TXT } from './res';


export interface AsmArgs {
    input: Path;
    output: Path;
}

function postProcess(results: AsmArgs) {
    if (results.output === undefined) {
        results.output = results.input.withExtension('.trivm');
    }
}

export function getAsmArgs(cmdLineArgs?: string[]) {
    let args = {} as AsmArgs;
    parse<AsmArgs>(ARGS_TXT, args, undefined, postProcess, cmdLineArgs || platform.getArgv());
    return args;
}
