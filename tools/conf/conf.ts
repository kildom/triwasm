
export interface ConfExtensions {
    unwind: boolean;
    mem64: boolean;
    int64: boolean;
    float32: boolean;
    float64: boolean;
}

export interface ConfFaults {
    // VM faults
    stackOverflow: boolean;
    stackUnderflow: boolean;
    instrOutOfBounds: boolean;
    instrInvalid: boolean;
    accessOutOfBounds: boolean;
    readOnly: boolean;
    divisionByZero: boolean;
    auxStackOverflow: boolean;
    auxStackUnderflow: boolean;
    // WASM faults
    wasmUnreachable: boolean;
    wasmTableIndex: boolean;
    // Group of faults
    anyFault: boolean;
    anyVmFault: boolean;
    anyWasmFault: boolean;
}

export interface ConfMemory {
    growable: boolean;
    min: number;
    max: number;
/*
    Memory types:                            growable    min      max
        - growable, min known, max known      true        N        M
        - growable, min unknown, max known    true        0        M
        - growable, min known, max unknown    true        N     0x70000000
        - growable, min unknown, max unknown  true        0     0x70000000
        - fixed, size known                   false       N        N
        - fixed, size unknown                 false       0     0x70000000
        - fixed, size in range                false       N        M
*/
}

export interface ConfProgram {
    rom: boolean;
    max: number;
}

export interface ConfHost {
    callbacks: boolean;
    importTableGrow: boolean;
    exportTableGrow: boolean;
}

export interface ConfWasm {
    entryFunction?: string;
}

export interface Conf {
    extensions: ConfExtensions;
    faults: ConfFaults;
    memory: ConfMemory;
    program: ConfProgram;
    host: ConfHost;
    wasm: ConfWasm;
}

/*
fixed size:
    build time known
    build time unknown
growable size:
    build time known
    build time unknown
*/
