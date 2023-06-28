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


/** Regular expression for parsing options from usage text.
 *
 * ```text
 * Argument types:
 *     -x     short option: name = group 2
 *     --out  long option:  name = group 3
 *            positional:   groups 2, 3 empty
 * Filter:
 *     group 4 if exists
 * Count:
 *     min = group 5 if exists
 *     max = group 6 prefixed by '-'
 *     max = inf. if group 6 == '-'
 * Tag:
 *     tag = group 7
 *                   (------------1--------------) (-----------------) (-------------------------) (----------------------)
 *                     (---2----)   (-----3-----)      (------4-----)       (---5--)(---6----)              (----7------)
 * ```
 */
const usageArgRe = /^(-([a-z0-9])|--([a-z0-9_-]+))?(?::(!?[a-z0-9_]+))?(?:\[([0-9]+)(-?[0-9]*)?\])?(?:[ =]?<([a-z0-9_-]+)>)?$/i;


/** Type of the option.
 */
export enum OptionType {
    /** Short option e.g. `-v` */
    SHORT,
    /** Long option e.g. `--output` */
    LONG,
    /** Positional option e.g. `<file>` */
    POSITIONAL,
};


/** Function type for filtering input arguments during command line parsing.
 * @remarks The function can *throw* ArgsParserError to report argument error.
 * @param arg     Input argument value.
 * @param option  Option that was used to parse this argument.
 * @param parser  The parser object.
 * @returns       Transformed argument value.
 */
export type FilterFunction = (arg: any, option: Option, parser: ArgsParser) => any;


/** Represents a single command line option.
 * @remarks Aliased options are grouped into one {@link OptionsGroup}, e.g.
 * `-o` and `--output`.
 */
export interface Option {
    /** Option type. */
    type: OptionType;
    /** Name of the option with dashes if needed, e.g. `-o`, `--output` or `file`. */
    name: string;
    /** If the option expects value, it contains tag to print in the usage. */
    tag: string | null;
    /** Group of options that this option belongs to. */
    group: OptionsGroup;
};


/** Group of aliased options.
 * @remarks Each group will produce one field after command line parsing.
 */
export class OptionsGroup {
    /** Array of options in this group. */
    public options: Option[] = [];
    /** Name of the group. The output field will have the same name, e.g. `--output-file` will generate field `outputField`. */
    public name: string = '';
    /** Name of this group that should be displayed to the user. It is the last option name. */
    public displayName: string = '';
    /** `true` if this option expects value. */
    public hasValue: boolean = false;
    /** `true` if this option will generate an array output. */
    public arrayValue: boolean = false;
    /** Minimum number of options in command line. */
    public minCount: number = 0;
    /** Maximum number of options in command line. */
    public maxCount: number = 0;
    /** Filter function. It will be called just before assigning the value to the output field. */
    public filter: FilterFunction | null = null;
    /** Filter function. It will be called just before assigning the value to the output field. */
    public filterEarly: boolean = false;
    /** Help text, one line per array item. Common indentation is removed. */
    public help: string[] = [];
};


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
const stdFilters = {
    help: (arg: any, option: Option, parser: ArgsParser) => {
        parser.printUsage();
        platform.exit(0);
    }
}


/** Command line arguments parser class.
 * @remarks
 * Expected arguments are taken from the `usage` constructor parameter.
 *
 * Example of usage string:
 *
 * ```text
 * Usage: your-program [--help] [-o <file>] <input-file>
 *
 * This is some summary of your tool.
 *
 * -o <file>
 * --output=<file>
 *      Output file.
 *
 * <input-file>
 *      Input file.
 *
 * --help:help
 *      Show this help text.
 * ```
 *
 * Format of the usage is following:
 * ```text
 * header-text
 * option-alias
 * option-alias
 * ...
 * option
 *      option-description
 * option-alias
 * option-alias
 * ...
 * option
 *      option-description
 * ...
 * ```
 * 
 * Where:
 *  * `header-text` and `option-description` are multiline strings. Line cannot start
 *    with `-`, `<`, `:`, `=` or `[`.
 *  * `option` contains following parts:
 *    * Option name starting with `-` or `--`. Short options can only have one letter or digit as a name.
 *      Long options can have letters, digits, `_` and `-`, e.g. `-o`, `--output-file`.
 *      Positional options does not have this part.
 *    * Optional filter name prefixed with `:`, e.g. `:int`. This can be build-in filter or user
 *      defined filter.
 *    * Optional allowed number of options that can be in the command line surrounded by the `[ ]`.
 *      Single number allows exact number of options, e.g. `[2]`. This can also ba range, e.g. `[0-1]`.
 *      Omit second number to get unlimited range, e.g. `[1-]`.
 *    * A value tag surrounded by the `< >`, if option expects a value. Can be also prefixed by space
 *      or `=`.
 *  * `option-alias` contains the same parts as `option` except filter and range.
 */
export class ArgsParser {

    /** Map of all short and long options. */
    private options: { [k: string]: Option } = {};
    /** Array of all positional options ordered as in the command line. */
    private posOptions: Option[] = [];
    /** Array of all option groups. */
    private groups: OptionsGroup[] = [];
    /** Usage message that will be printed before list of options. */
    private usage: string[] = [];
    /** Current positional argument index (in {@link posOptions} array) used during command line parsing. */
    private posOptionIndex: number = 0;

    /** Creates new parser.
     * @param usage   Usage text to parse. See {@link ArgsParser}.
     * @param filters Map of user defined option filters.
     */
    public constructor(usage: string, filters?: { [k: string]: FilterFunction }) {
        this.parseUsage(usage, filters);
    }

    /** Parse usage string and prepare this object for parsing command line arguments.
     * @param usage   Usage text to parse. See {@link ArgsParser}.
     * @param filters Map of user defined option filters.
     */
    private parseUsage(usage: string, filters?: { [k: string]: FilterFunction }) {
        // Merge user-defined and standard filters
        filters = { ...stdFilters, ...(filters || {}) };
        // Prepare lines
        let lines = usage.split('\n')
            .map(x => x.trimEnd())
            .filter((x, i, arr) => x != '' || (i != 0 && arr[i - 1] != ''));
        // Remove common prefix
        lines = this.removeCommonIndent(lines);
        // Parse line by line
        let group = new OptionsGroup();
        for (let line of lines) {
            // Match line with option regular expression
            let m = line.match(usageArgRe);
            // If it is not an option, assume that it is help
            if (!line || !m) {
                group.help.push(line);
                continue;
            }
            // Try to add recent group to this object and prepare new one
            group = this.addGroup(group);
            // Create option object
            let name = m[1] || m[7];
            let tag = m[7] || null;
            let type = !m[1] ? OptionType.POSITIONAL : m[2] ? OptionType.SHORT : OptionType.LONG;
            let option = { type, name, tag, group };
            // Update group with information from recently parsed option
            group.options.push(option);
            group.name = name
                .replace(/^--?/, '')
                .replace(/-([a-z0-9])/gi, (_, x: string) => x.toUpperCase())
                .replace(/^([0-9])/, '_$1');
            group.displayName = name;
            group.hasValue = tag !== null;
            group.minCount = type == OptionType.POSITIONAL ? 1 : 0;
            group.maxCount = group.hasValue ? 1 : Infinity;
            if (m[5]) {
                group.minCount = parseInt(m[5]);
                group.maxCount = group.minCount;
                if (m[6] == '-') {
                    group.maxCount = Infinity;
                } else if (m[6]) {
                    group.maxCount = -parseInt(m[6]);
                }
            }
            group.arrayValue = group.hasValue && group.maxCount > 1;
            if (m[4]) {
                let filterName = m[4];
                if (filterName.startsWith('!')) {
                    group.filterEarly = true;
                    filterName = filterName.substring(1);
                }
                group.filter = filters ? filters[filterName] : null;
                if (!group.filter) {
                    throw new Error(`Unknown filter "${filterName}"`);
                }
            } else {
                group.filter = null;
            }
            // Add option to this object
            if (type == OptionType.POSITIONAL) {
                this.posOptions.push(option);
            } else {
                this.options[name] = option;
            }
        }
        // Add last group to this object
        this.addGroup(group);
    }

    /** Add group to {@link groups} if it is finished.
     * @remarks If group has no options, its help is appended to {@link usage} and
     * returns a new empty group.
     * @param group Group to add
     * @returns     New empty group or the same group if it is not finished yet.
     */
    private addGroup(group: OptionsGroup): OptionsGroup {
        if (group.help.length == 0)
            return group;

        group.help = this.removeCommonIndent(group.help);

        if (group.options.length == 0) {
            this.usage = group.help;
            return new OptionsGroup();
        }

        this.groups.push(group);

        return new OptionsGroup();
    }

    /** Removes indentation that is common for each line (except empty lines) and
     * removes empty lines from the beginning and ending of the text.
     * @param lines array of lines
     * @returns     a new array of lines
     */
    private removeCommonIndent(lines: string[]) {
        let indents = lines
            .filter(x => x.trim())
            .map(x => (x.match(/^[\t ]*/) || [''])[0]);
        let common = indents[0] || '';
        for (let indent of indents)
            while (!indent.startsWith(common))
                common = common.substring(0, common.length - 1);
        lines = lines.map(x => x.substring(common.length));
        while (lines.length && lines[0].trim() == '')
            lines.shift();
        while (lines.length && lines[lines.length - 1].trim() == '')
            lines.pop();
        return lines;
    }

    /** Print usage information.
     * @remarks Can be done automatically with the `help` filter.
     */
    public printUsage() {
        console.log(this.usage.join('\n'));
        console.log();
        for (let group of this.groups) {
            for (let option of group.options) {
                let text: string;
                switch (option.type) {
                    case OptionType.POSITIONAL:
                        text = '';
                        break;
                    case OptionType.SHORT:
                        text = `${option.name} `;
                        break;
                    case OptionType.LONG:
                        text = `${option.name}=`;
                        break;
                }
                if (option.tag) {
                    text += `<${option.tag}>`;
                } else {
                    text = text.substring(0, text.length - 1);
                }
                console.log(text);
            }
            console.log('        ' + group.help.join('\n        '));
            console.log();
        }
    }

    /** Parse command line parameters.
     * 
     * @param output Output object where output fields will be saved. If not provided or `null`,
     *               new object will be created.
     * @param args   Command line arguments. Program name is not included,
     *               so the actual arguments starts at index 0. If not provided, current process
     *               arguments will be taken.
     * @returns      The output object.
     */
    public parse(output?: { [k: string]: any } | null, args?: string[]) {
        output = output || {};
        let container: { [k: string]: any } = {};
        this.posOptionIndex = 0;
        try {
            args = args || platform.getArgv();
            for (let i = 0; i < args.length; i++) {
                let arg: string = args[i];
                if (arg == '--') {
                    for (i = i + 1; i < args.length; i++)
                        this.parsePositionalArg(container, args[i]);
                } else if (arg == '-') {
                    this.parsePositionalArg(container, arg);
                } else if (arg.startsWith('--')) {
                    if (this.parseOptionalArg(container, arg, args[i + 1]))
                        i++;
                } else if (arg.startsWith('-')) {
                    let strLast = arg.length - 1
                    for (let k = 1; k < strLast; k++)
                        this.parseOptionalArg(container, `-${arg[k]}`, undefined);
                    if (this.parseOptionalArg(container, `-${arg[strLast]}`, args[i + 1]))
                        i++;
                } else {
                    this.parsePositionalArg(container, arg);
                }
            }
            for (let group of this.groups) {
                let value = container[group.name] || [];
                if (value.length < group.minCount) {
                    throw new ArgsParserError(`Argument "${group.displayName}" must be provided at least ${group.minCount} time(s).`);
                } else if (value.length > group.maxCount) {
                    throw new ArgsParserError(`Argument "${group.displayName}" must be provided at most ${group.minCount} time(s).`);
                }
                if (group.hasValue) {
                    if (!group.arrayValue) {
                        if (value.length > 0) {
                            value = value[0];
                        } else {
                            value = output[group.name];
                        }
                    } else {
                        if (value.length == 0 && output[group.name] !== undefined) {
                            value = output[group.name];
                        }
                    }
                } else {
                    value = value.length;
                }
                if (group.filter && !group.filterEarly) {
                    value = group.filter(value, group.options[group.options.length - 1], this);
                }
                output[group.name] = value;
            }
        } catch (ex: unknown) {
            if (ex instanceof ArgsParserError) {
                let msg = ex.message;
                console.error(msg);
                console.error();
                this.printUsage();
                platform.exit(99);
            }
            throw ex;
        }
        return container;
    }

    /** Parse optional command line argument.
     * @param container Output object.
     * @param arg       Argument to interpret.
     * @param nextArg   Next argument after current one or `undefined` if there is no more arguments.
     * @returns         `true` if the next argument was used.
     */
    private parseOptionalArg(container: { [k: string]: any }, arg: string, nextArg?: string): boolean {
        let nextArgUsed = false;
        let option: Option;
        let splitPos = arg.indexOf('=');
        if (splitPos > 0) {
            option = this.options[arg.substring(0, splitPos)];
        } else {
            option = this.options[arg];
        }
        if (!option) {
            throw new ArgsParserError(`Unknown option "${arg}".`);
        }
        let group = option.group;
        let value: any = null;
        if (group.hasValue) {
            if (splitPos > 0) {
                value = arg.substring(splitPos + 1);
            } else {
                value = nextArg;
                nextArgUsed = true;
            }
            if (value === undefined)
                throw new ArgsParserError(`Option "${option.name}" requires an argument.`);
        }
        if (!(group.name in container)) {
            container[group.name] = [];
        }
        if (group.filter && group.filterEarly) {
            value = group.filter(value, group.options[group.options.length - 1], this);
        }
        container[group.name].push(value);
        return nextArgUsed;
    }

    /** Parse positional command line argument.
     * @remarks The {@link posOptionIndex} will track next positional option to use.
     * @param container Output object.
     * @param arg       Argument to interpret.
     */
    private parsePositionalArg(container: { [k: string]: any }, arg: string) {
        if (this.posOptionIndex >= this.posOptions.length) {
            throw new ArgsParserError(`Too many arguments.`);
        }
        let option = this.posOptions[this.posOptionIndex];
        let group = option.group;
        if (!(group.name in container)) {
            container[group.name] = [];
        }
        if (group.filter && group.filterEarly) {
            arg = group.filter(arg, group.options[group.options.length - 1], this);
        }
        container[group.name].push(arg);
        if (container[group.name].length >= group.maxCount) {
            this.posOptionIndex++;
        }
    }

    /** Do parsing in one step.
     * @remarks First, {@link ArgsParser} object is created. Next, it is used to parse command
     * line arguments. Finally, the result is returned.
     * @param usage   See {@link constructor}.
     * @param output  See {@link (parse:instance)}.
     * @param filters See {@link constructor}.
     * @param args    See {@link (parse:instance)}.
     * @returns       See {@link (parse:instance)}.
     */
    public static parse(usage: string, output?: { [k: string]: any } | null, filters?: { [k: string]: FilterFunction }, args?: string[]) {
        let a = new ArgsParser(usage, filters);
        return a.parse(output, args);
    }

}
