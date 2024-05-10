/*
 * Copyright (c) 2023 Dominik Kilian <kontakt@dominik.cc>
 *
 * This program is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this
 * program. If not, see <https://www.gnu.org/licenses/>.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { platform } from './platform';
import { Path } from './path';
import { versionString } from './version';


interface UsageArgReMatch {
    shortName?: string;
    longName?: string;
    fastFilter?: '!';
    filterName?: string;
    minCount?: string;
    hasRange?: '-';
    maxCount?: string;
    valueName: string;
    defaultValue?: string;
}

/** Regular expression for parsing options from usage text.
 */
/* cre.ignoreCase.legacy`
    begin-of-text
    optional {
        {
            "-"
            shortName: [a-z0-9]
        } or {
            "--"
            longName: at-least-2 [a-z0-9_-]
        }
        repeat space
    }
    optional {
        ":"
        repeat space
        optional fastFilter: "!"
        filterName: at-least-1 word-char
        repeat space
    }
    optional {
        "["
        minCount: at-least-1 digit
        optional {
            hasRange: "-"
            optional maxCount: at-least-1 digit
        }
        "]"
        repeat space
    }
    valueName: lazy-repeat any
    optional {
        lookbehind not "\\"
        "="
        defaultValue: repeat any
    }
    end-of-text
`*/
const usageArgRe = /^(?:(?:-(?<shortName>[a-z0-9])|--(?<longName>[a-z0-9_-]{2,})) *)?(?:: *(?<fastFilter>!)?(?<filterName>\w+) *)?(?:\[(?<minCount>\d+)(?:(?<hasRange>-)(?<maxCount>\d+)?)?\] *)?(?<valueName>.*?)(?:(?<!\\)=(?<defaultValue>.*))?$/is;


/** Type of the option.
 */
export enum OptionType {
    /** Short option e.g. `-v` */
    SHORT,
    /** Long option e.g. `--output` */
    LONG,
    /** Positional option e.g. `<file>` */
    POSITIONAL,
}


/** Function type for filtering input arguments during command line parsing.
 * @remarks The function can *throw* ArgsParserError to report argument error.
 * @param arg     Input argument value.
 * @param option  Option that was used to parse this argument.
 * @param parser  The parser object.
 * @returns       Transformed argument value.
 */
export type FilterFunction = (arg: any, option: Option, parser: ArgsParser<unknown>) => any;
export type PostProcessFunction<T> = (result: T, parser: ArgsParser<T>) => any;


/** Represents a single command line option.
 * @remarks Aliased options are grouped into one {@link OptionsGroup}, e.g.
 * `-o` and `--output`.
 */
export interface OptionAlias {
    /** Option type. */
    type: OptionType;
    /** Name of the option with dashes if needed, e.g. `-o`, `--output` or `file`. */
    name: string;
    /** Group of options that this option belongs to. */
    option: Option;
}


/** Group of aliased options.
 * @remarks Each group will produce one field after command line parsing.
 */
export class Option {
    /** Array of options in this group. */
    public aliases: OptionAlias[] = [];
    /** Name of the group. The output field will have the same name, e.g. `--output-file` will generate field `outputField`. */
    public name: string = '';
    /** Name of this group that should be displayed to the user. It is the last option name. */
    public displayName: string = '';
    /** Name of this value. */
    public valueName: string = '';
    /** `true` if this option expects value. */
    public hasValue: boolean = false;
    /** `true` if this option will generate an array output. */
    public arrayValue: boolean = false;
    /** Minimum number of options in command line. */
    public minCount: number = 0;
    /** Maximum number of options in command line. */
    public maxCount: number = 0;
    public defaultValue: string | null = null;
    /** Filter function. It will be called just before assigning the value to the output field. */
    public filter: FilterFunction | null = null;
    /** Apply filter function immediately, before parsing more following options. */
    public filterEarly: boolean = false;
    /** Help text, one line per array item. Common indentation is removed. */
    public help: string[] = [];
}


/** Error that can be thrown to indicate problem with the arguments.
 * @remarks The message will be shown to the user followed by the usage.
 */
export class ArgsParserError extends Error {
    public constructor(message?: string) {
        super(message);
    }
}


/** Standard argument filters.
 */
const builtinFilters = {
    help: (arg: any, option: Option, parser: ArgsParser<unknown>) => {
        parser.printUsage();
        platform.exit(0);
    },
    markdown: (arg: any, option: Option, parser: ArgsParser<unknown>) => {
        parser.printMarkdown();
        platform.exit(0);
    },
    ver: () => {
        console.log('triVM tools, version ' + versionString);
        console.log('JavaScript environment:', platform.info);
        platform.exit(0);
    },
    int: (arg: any) => {
        if (arg === undefined) return undefined;
        let text = ('' + arg).trim();
        let m: RegExpMatchArray | null;
        m = text.match(/^(?:-?[0-9]+|-?0x[0-9a-f]+)$/i);
        if (m) {
            return parseInt(m[0]);
        }
        throw new ArgsParserError(`Invalid integer: ${arg}`);
    },
    size: (arg: any) => {
        if (arg === undefined) return undefined;
        let mul = 1;
        let text = ('' + arg).trim();
        let m: RegExpMatchArray | null;
        if ((m = text.match(/^(.+)K(b|byte|bytes|)$/i))) {
            mul = 1024;
            text = m[1];
        } else if ((m = text.match(/^(.+)M(b|byte|bytes|)$/i))) {
            mul = 1024 * 1024;
            text = m[1];
        } else if ((m = text.match(/^(.+)G(b|byte|bytes|)$/i))) {
            mul = 1024 * 1024 * 1024;
            text = m[1];
        } else if ((m = text.match(/^(-?[0-9]+)\s*(b|byte|bytes|)$/i))) {
            mul = 1;
            text = m[1];
        } else if ((m = text.match(/^(-?0x[0-9a-f]+)\s*(byte|bytes|)$/i))) {
            mul = 1;
            text = m[1];
        } else if ((m = text.match(/^(.+)Kbits?$/i))) {
            mul = 1024 / 8;
            text = m[1];
        } else if ((m = text.match(/^(.+)Mbits?$/i))) {
            mul = 1024 * 1024 / 8;
            text = m[1];
        } else if ((m = text.match(/^(.+)Gbits?$/i))) {
            mul = 1024 * 1024 * 1024 / 8;
            text = m[1];
        } else if ((m = text.match(/^(.+)bits?$/i))) {
            let bits = builtinFilters.int(text) as number;
            if (bits & 7) {
                throw new ArgsParserError('Expecting multiple of 8 in bits size.');
            }
            return bits / 8;
        }
        let value = builtinFilters.int(text) as number;
        return mul * value;
    },
    Path: (arg: any) => {
        if (arg === undefined) return undefined;
        return new Path('' + arg);
    },
    FromFile: (arg: any, option: Option, parser: ArgsParser<unknown>) => {
        let path = new Path(arg);
        let argsStr = path.readString();
        let arr: string[] = [];
        for (let m of argsStr.matchAll(/\s*(".*?(?:"".*?)*"|[^ ]+)/g)) {
            let text = m[1].trim();
            if (text !== '') {
                if (text.startsWith('"')) {
                    text = text.replace(/""/g, '"');
                }
                arr.push(text);
            }
        }
        parser.args.splice(parser.argIndex, 0, ...arr);
    }
};

type ParseArrays = { [name: string]: { option: Option, values: string[]; }; };


export class ArgsParser<T> {

    header: string[] = [];
    filters: { [name: string]: FilterFunction; };
    options: Option[] = [];
    shortOptions = new Map<string, Option>();
    longOptions = new Map<string, Option>();
    posOptions: Option[] = [];
    args: string[] = [];
    argIndex: number = 0;

    public constructor(
        usage: string,
        filters?: { [name: string]: FilterFunction; },
        private postProcess?: PostProcessFunction<T>
    ) {
        this.filters = { ...builtinFilters, ...filters };
        this.parseUsage(usage);
    }

    parseUsage(usage: string) {
        let currentHelpOutput = this.header;
        let currentOption: Option | null = null;
        let lines = usage.split('\n')
            .map(x => x.trimEnd())
            .filter((x, i, arr) => x != '' || (i != 0 && arr[i - 1] != ''));
        for (let line of lines) {

            let m = line.match(usageArgRe)?.groups as unknown as UsageArgReMatch;

            if (!m || !line.trim() || line.match(/^\s/)) {
                currentHelpOutput.push(line);
                currentOption = null;
                continue;
            }

            if (currentOption === null) {
                currentOption = new Option();
                this.options.push(currentOption);
                currentHelpOutput = currentOption.help;
            }

            if (m.shortName) {
                currentOption.aliases.push({
                    name: m.shortName.trim(),
                    type: OptionType.SHORT,
                    option: currentOption,
                });
                this.shortOptions.set(m.shortName.trim(), currentOption);
            } else if (m.longName) {
                currentOption.aliases.push({
                    name: m.longName.trim(),
                    type: OptionType.LONG,
                    option: currentOption,
                });
                this.longOptions.set('--' + m.longName.trim().toLowerCase(), currentOption);
            } else {
                currentOption.aliases.push({
                    name: m.valueName.trim(),
                    type: OptionType.POSITIONAL,
                    option: currentOption,
                });
                if (this.posOptions.at(-1) !== currentOption) {
                    this.posOptions.push(currentOption);
                }
            }
            /*
             * group 1: short option
             * group 2: long option
             * group 3: "!" for fast filters
             * group 4: filter name
             * group 5: minimum count
             * group 6: "-" if count contains range
             * group 7: maximum count
             * group 8: value name
             * group 9: default value
             */
            if (m.filterName) {
                currentOption.filter = this.filters[m.filterName];
                currentOption.filterEarly = !!m.fastFilter;
            } else {
                currentOption.filter = null;
                currentOption.filterEarly = false;
            }
            currentOption.hasValue = !!m.valueName;
            currentOption.valueName = (m.valueName || '').replace(/\\=/g, '=');
            if (m.minCount) {
                currentOption.minCount = parseInt(m.minCount);
                if (m.hasRange) {
                    if (m.maxCount) {
                        currentOption.maxCount = parseInt(m.maxCount);
                    } else {
                        currentOption.maxCount = Number.POSITIVE_INFINITY;
                    }
                } else {
                    currentOption.maxCount = currentOption.minCount;
                }
            } else {
                currentOption.minCount = 0;
                currentOption.maxCount = 1;
            }
            currentOption.arrayValue = currentOption.maxCount > 1;
            currentOption.defaultValue = m.defaultValue?.trim() ? m.defaultValue.trim() : null;
            switch (currentOption.aliases.at(-1)!.type) {
            case OptionType.SHORT: currentOption.displayName = '-'; break;
            case OptionType.LONG: currentOption.displayName = '--'; break;
            case OptionType.POSITIONAL: currentOption.displayName = ''; break;
            }
            currentOption.displayName += currentOption.aliases.at(-1)!.name;
            currentOption.name = currentOption.displayName
                .replace(/[^a-z0-9]/gi, ' ')
                .trim()
                .toLowerCase()
                .replace(/\s+[a-z]/gi, (x: string) => x.trim().toUpperCase());
        }
    }

    private printHelpLines(lines: string[], indent: string, markdown: boolean = false) {
        let common = 10000;
        for (let line of lines) {
            let m = line.match(/^\s*/);
            if (line.trim() && m) {
                common = Math.min(m[0].length, common);
            }
        }
        let output = '';
        for (let line of lines) {
            let lineTrimmed = line.substring(common).trimEnd();
            let markdownOnly = lineTrimmed.startsWith(':');
            let textOnly = lineTrimmed.startsWith(';');
            if ((markdown && textOnly) || (!markdown && markdownOnly)) {
                continue;
            } else if (markdownOnly || textOnly) {
                lineTrimmed = lineTrimmed.substring(1);
            }
            if (markdown && !markdownOnly) {
                lineTrimmed = lineTrimmed.replace(/(<[a-z0-9_-]+>)/gi, '`$1`');
            }
            if (!markdown && !textOnly) {
                lineTrimmed = lineTrimmed.replace(/`/g, '"');
            }
            output += lineTrimmed + '\n';
        }
        console.log(indent + output
            .trimEnd()
            .replace(/\n/g, '\n' + indent));
    }

    public printUsage() {
        console.log();
        this.printHelpLines(this.header, '');
        console.log();
        for (let option of this.options) {
            for (let alias of option.aliases) {
                let text: string;
                switch (alias.type) {
                case OptionType.POSITIONAL:
                    text = ' ';
                    break;
                case OptionType.SHORT:
                    text = `-${alias.name} `;
                    break;
                case OptionType.LONG:
                    text = `--${alias.name} `;
                    break;
                }
                if (option.hasValue) {
                    text += option.valueName.trim();
                } else {
                    text = text.substring(0, text.length - 1);
                }
                console.log(text.trim());
            }
            this.printHelpLines(option.help, '    ');
            console.log();
        }
    }

    public printMarkdown() {
        console.log(`<!-- Markdown generated with option "${platform.getArgv().join(' ')}". Do not edit it manually. -->`);
        console.log();
        this.printHelpLines(this.header, '', true);
        console.log();
        for (let option of this.options) {
            let first = true;
            for (let alias of option.aliases) {
                let text: string;
                switch (alias.type) {
                case OptionType.POSITIONAL:
                    text = ' ';
                    break;
                case OptionType.SHORT:
                    text = `**\`-${alias.name}\`** `;
                    break;
                case OptionType.LONG:
                    text = `**\`--${alias.name}\`** `;
                    break;
                }
                if (option.hasValue) {
                    text += `\`${option.valueName.trim()}\``;
                } else {
                    text = text.substring(0, text.length - 1);
                }
                if (first) {
                    first = false;
                    console.log(`* ${text.trim()}`);
                } else {
                    console.log(`\n  ${text.trim()}`);
                }
            }
            console.log();
            this.printHelpLines(option.help, '  ', true);
            console.log();
        }
    }

    private parseToArrays(args?: string[]): ParseArrays {
        ///args = [...(args || platform.getArgv())];
        this.args = [...(args || platform.getArgv())];
        this.argIndex = 0;
        let result: ParseArrays = Object.fromEntries(this.options.map(option => [option.name, { option, values: [] }]));
        let posIndex = 0;
        let posCount = 0;
        let argChar = 0;
        let onlyPos = false;
        while (this.argIndex < this.args.length) {
            // skip already parsed characters in packed short options
            let arg = this.args[this.argIndex].substring(argChar);
            // determine current option
            let option: Option | undefined = undefined;
            let optionName: string;
            if (argChar > 0) {
                // this is next character of packed short options, skip it and get value from the rest of the argument
                option = this.shortOptions.get(arg[0]);
                optionName = '-' + arg[0];
                argChar++;
                arg = arg.substring(1);
                // go to next argument if there is no more characters in this packed short options
                if (arg === '') {
                    this.argIndex++;
                    arg = this.args[this.argIndex];
                    argChar = 0;
                }
            } else if (!onlyPos && arg.startsWith('--')) {
                if (arg.length > 2) {
                    // long option and use next argument
                    optionName = arg.toLocaleLowerCase();
                    let pos = optionName.indexOf('=');
                    if (pos > 0) {
                        optionName = optionName.substring(0, pos);
                        arg = arg.substring(pos + 1);
                    } else {
                        this.argIndex++;
                        arg = this.args[this.argIndex];
                    }
                    option = this.longOptions.get(optionName);
                } else {
                    // "--" indicates start of positional-only arguments in command line, continue with next argument
                    onlyPos = true;
                    this.argIndex++;
                    continue;
                }
            } else if (!onlyPos && arg.startsWith('-') && arg.length > 1) {
                // this is start of packed short options, continue with this argument, but start with next character
                argChar = 1;
                continue;
            } else {
                // this is positional argument
                option = this.posOptions[posIndex];
                posCount++;
                if (option && posCount > option.maxCount) {
                    posIndex++;
                    posCount = 0;
                    option = this.posOptions[posIndex];
                }
                optionName = 'Too many positional arguments';
            }

            // Detect invalid options
            if (option === undefined) {
                throw new ArgsParserError(`Unknown or invalid option: ${optionName}`);
            }

            // Get value from next argument if needed
            let value: string = '';
            if (option.hasValue) {
                if (arg === undefined) {
                    throw new ArgsParserError(`Expecting argument after: ${optionName}`);
                }
                value = arg;
                this.argIndex++;
                argChar = 0;
            }

            // Apply early filters
            if (option.filterEarly && option.filter) {
                value = option.filter(value, option, this as ArgsParser<unknown>);
            }

            // Push value to this option
            result[option.name].values.push(value);
        }
        return result;
    }

    private arraysToOutput(output: any, arrays: ParseArrays) {
        for (let { option, values } of Object.values(arrays)) {
            if (values.length == 0 && option.defaultValue !== null && option.minCount <= 1) {
                values.push(option.defaultValue);
            } else if (values.length < option.minCount) {
                throw new ArgsParserError(`Expected more arguments for ${option.displayName}`);
            } else if (values.length > option.maxCount) {
                throw new ArgsParserError(`Too many arguments for ${option.displayName}`);
            }
            let result: any;
            if (option.arrayValue) {
                result = option.hasValue ? values : values.length;
            } else {
                result = option.hasValue ? values[0] : (values.length > 0);
            }
            if (option.filter && !option.filterEarly) {
                if (typeof (result) == 'object') {
                    result = result.map((x: any) => option.filter!(x, option, this as ArgsParser<unknown>));
                } else {
                    result = option.filter(result, option, this as ArgsParser<unknown>);
                }
            }
            output[option.name] = result;
        }
    }

    parse(output: T, args?: string[]) {
        try {
            let arrays = this.parseToArrays(args);
            this.arraysToOutput(output as any, arrays);
            if (this.postProcess) {
                this.postProcess(output, this);
            }
        } catch (ex: unknown) {
            if (ex instanceof ArgsParserError) {
                console.error(ex.message);
                console.error();
                this.printUsage();
                platform.exit(99);
            }
            throw ex;
        }
    }
}

export function parse<T>(usage: string, output: T, filters?: { [name: string]: FilterFunction; },
    postProcess?: PostProcessFunction<T>, args?: string[]) {

    let a = new ArgsParser(usage, filters, postProcess);
    return a.parse(output, args);
}
