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

import * as x from './platform-impl';
declare const _triwasm_platform_impl: unknown;
declare global {
    const trace: boolean;
}

export interface Platform {
    getArgv(): string[];
    exit(code?: number): void;
    readFile(path: string, binary: true): Uint8Array;
    readFile(path: string, binary?: false): string;
    writeFile(path: string, content: string | Uint8Array): void;
    getHRTimer(): number;
    scriptFile: string;
    isWindows: boolean;
    info: string;
    main(callback: () => void): void;
}

export const platform: Platform = (
    typeof (_triwasm_platform_impl) === 'object'
        ? _triwasm_platform_impl
        : x._triwasm_platform_impl
    ) as Platform;
