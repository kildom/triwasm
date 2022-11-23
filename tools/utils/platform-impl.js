/*!
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

const _triwasm_platform_impl =

/* ------------------------------------ Node.js ------------------------------------ */
(typeof(process) == 'object' && typeof(process.versions) == 'object' && typeof(process.versions.node) == 'string') ?
(function() {
    const platform = {};

    const fs = require('fs');

    platform.getArgv = function() {
        return process.argv.slice(2);
    };

    platform.exit = function(code) {
        process.exit(code || 0);
    };

    platform.readFile = function(path, binary) {
        if (binary) {
            let buf = fs.readFileSync(path);
            return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        } else {
            return fs.readFileSync(path, 'utf-8');
        }
    }

    platform.writeFile = function(path, content) {
        fs.writeFileSync(path, content);
    }

    platform.info = function() {
        if (('electron' in process.versions) && ('chrome' in process.versions)) {
            return `Electron ${process.versions.electron} with Chromium ${process.versions.chrome}, Node.js ${process.version}, V8 ${process.versions.v8} running on ${process.platform}, path ${process.execPath}`;
        } else {
            return `Node.js ${process.version} with V8 ${process.versions.v8} running on ${process.platform}, path ${process.execPath}`;
        }
    }

    return platform;
})():

/* ------------------------------------ Deno ------------------------------------ */
(typeof(Deno) == 'object' && typeof(Deno.version) == 'object' && typeof(Deno.version.deno) == 'string') ?
(function() {
    const platform = {};

    platform.getArgv = function() {
        return Deno.args;
    };

    platform.exit = function(code) {
        Deno.exit(code || 0);
    };

    platform.readFile = function(path, binary) {
        if (binary) {
            return Deno.readFileSync(path);
        } else {
            return Deno.readTextFileSync(path);
        }
    }

    platform.writeFile = function(path, content) {
        if (typeof(content) === 'string') {
            Deno.writeTextFileSync(path, content);
        } else {
            Deno.writeFileSync(path, content);
        }
    }

    platform.info = function() {
        return `Deno ${Deno.version.deno} with V8 ${Deno.version.v8}, path ${Deno.execPath()}`;
    }

    return platform;
})():

/* ------------------------------------ QuickJS ------------------------------------ */
(typeof(scriptArgs) == 'object' && typeof(os) == 'object' && typeof(std) == 'object' && typeof(os.S_IFIFO) == 'number') ?
(function() {
    const platform = {};

    const ERRORS = [
        "EOK: No error", "EPERM: Operation not permitted", "ENOENT: No such file or directory",
        "ESRCH: No such process", "EINTR: Interrupted system call", "EIO: I/O error",
        "ENXIO: No such device or address", "E2BIG: Argument list too long", "ENOEXEC: Exec format error",
        "EBADF: Bad file number", "ECHILD: No child processes", "EAGAIN: Try again", "ENOMEM: Out of memory",
        "EACCES: Permission denied", "EFAULT: Bad address", "ENOTBLK: Block device required",
        "EBUSY: Device or resource busy", "EEXIST: File exists", "EXDEV: Cross-device link",
        "ENODEV: No such device", "ENOTDIR: Not a directory", "EISDIR: Is a directory",
        "EINVAL: Invalid argument", "ENFILE: File table overflow", "EMFILE: Too many open files",
        "ENOTTY: Not a typewriter", "ETXTBSY: Text file busy", "EFBIG: File too large",
        "ENOSPC: No space left on device", "ESPIPE: Illegal seek", "EROFS: Read-only file system",
        "EMLINK: Too many links", "EPIPE: Broken pipe", "EDOM: Math argument out of domain of func",
        "ERANGE: Math result not representable", "EDEADLK: Resource deadlock would occur",
        "ENAMETOOLONG: File name too long", "ENOLCK: No record locks available",
        "ENOSYS: Invalid system call number", "ENOTEMPTY: Directory not empty",
        "ELOOP: Too many symbolic links encountered", "UNKNOWN41: Unknown error code",
        "ENOMSG: No message of desired type", "EIDRM: Identifier removed",
        "ECHRNG: Channel number out of range", "EL2NSYNC: Level 2 not synchronized",
        "EL3HLT: Level 3 halted", "EL3RST: Level 3 reset", "ELNRNG: Link number out of range",
        "EUNATCH: Protocol driver not attached", "ENOCSI: No CSI structure available", "EL2HLT: Level 2 halted",
        "EBADE: Invalid exchange", "EBADR: Invalid request descriptor", "EXFULL: Exchange full",
        "ENOANO: No anode", "EBADRQC: Invalid request code", "EBADSLT: Invalid slot",
        "UNKNOWN58: Unknown error code", "EBFONT: Bad font file format", "ENOSTR: Device not a stream",
        "ENODATA: No data available", "ETIME: Timer expired", "ENOSR: Out of streams resources",
        "ENONET: Machine is not on the network", "ENOPKG: Package not installed", "EREMOTE: Object is remote",
        "ENOLINK: Link has been severed", "EADV: Advertise error", "ESRMNT: Srmount error",
        "ECOMM: Communication error on send", "EPROTO: Protocol error", "EMULTIHOP: Multihop attempted",
        "EDOTDOT: RFS specific error", "EBADMSG: Not a data message",
        "EOVERFLOW: Value too large for defined data type", "ENOTUNIQ: Name not unique on network",
        "EBADFD: File descriptor in bad state", "EREMCHG: Remote address changed",
        "ELIBACC: Can not access a needed shared library", "ELIBBAD: Accessing a corrupted shared library",
        "ELIBSCN: .lib section in a.out corrupted", "ELIBMAX: Attempting to link in too many shared libraries",
        "ELIBEXEC: Cannot exec a shared library directly", "EILSEQ: Illegal byte sequence",
        "ERESTART: Interrupted system call should be restarted", "ESTRPIPE: Streams pipe error",
        "EUSERS: Too many users", "ENOTSOCK: Socket operation on non-socket",
        "EDESTADDRREQ: Destination address required", "EMSGSIZE: Message too long",
        "EPROTOTYPE: Protocol wrong type for socket", "ENOPROTOOPT: Protocol not available",
        "EPROTONOSUPPORT: Protocol not supported", "ESOCKTNOSUPPORT: Socket type not supported",
        "EOPNOTSUPP: Operation not supported on transport endpoint", "EPFNOSUPPORT: Protocol family not supported",
        "EAFNOSUPPORT: Address family not supported by protocol", "EADDRINUSE: Address already in use",
        "EADDRNOTAVAIL: Cannot assign requested address", "ENETDOWN: Network is down",
        "ENETUNREACH: Network is unreachable", "ENETRESET: Network dropped connection because of reset",
        "ECONNABORTED: Software caused connection abort", "ECONNRESET: Connection reset by peer",
        "ENOBUFS: No buffer space available", "EISCONN: Transport endpoint is already connected",
        "ENOTCONN: Transport endpoint is not connected", "ESHUTDOWN: Cannot send after transport endpoint shutdown",
        "ETOOMANYREFS: Too many references: cannot splice", "ETIMEDOUT: Connection timed out",
        "ECONNREFUSED: Connection refused", "EHOSTDOWN: Host is down",
        "EHOSTUNREACH: No route to host", "EALREADY: Operation already in progress",
        "EINPROGRESS: Operation now in progress", "ESTALE: Stale file handle",
        "EUCLEAN: Structure needs cleaning", "ENOTNAM: Not a XENIX named type file",
        "ENAVAIL: No XENIX semaphores available", "EISNAM: Is a named type file",
        "EREMOTEIO: Remote I/O error", "EDQUOT: Quota exceeded", "ENOMEDIUM: No medium found",
        "EMEDIUMTYPE: Wrong medium type", "ECANCELED: Operation Canceled", "ENOKEY: Required key not available",
        "EKEYEXPIRED: Key has expired", "EKEYREVOKED: Key has been revoked",
        "EKEYREJECTED: Key was rejected by service", "EOWNERDEAD: Owner died",
        "ENOTRECOVERABLE: State not recoverable", "ERFKILL: Operation not possible due to RF-kill",
        "EHWPOISON: Memory page has hardware error",
    ];

    function errstr(code) {
        code = Math.abs(code);
        if (code >= ERRORS.length) {
            return `${code}: Unknown error code`;
        } else {
            return `${code}: ${ERRORS[code]}`;
        }
    }

    platform.getArgv = function() {
        return scriptArgs.slice(1);
    };

    platform.exit = function(code) {
        std.exit(code || 0);
    };

    platform.readFile = function(path, binary) {
        let err = { errno: 0 };
        let f = std.open(path, 'rb', err);
        if (!f) {
            throw new Error(`File open error: ${errstr(err.errno)}`);
        }
        try {
            if (binary) {
                let buf = new Uint8Array(65536);
                let pos = 0;
                while (!f.eof()) {
                    if (pos >= buf.length) {
                        let old = buf;
                        buf = new Uint8Array(2 * old.length);
                        buf.set(old);
                    }
                    let n = f.read(buf.buffer, buf.byteOffset + pos, buf.length - pos);
                    if (n < 0) {
                        throw new Error(`File read error: ${errstr(n)}`);
                    } else if (n == 0) {
                        break;
                    } else {
                        pos += n;
                    }
                }
                return buf.slice(0, pos);
            } else {
                let res = f.readAsString();
                if (typeof(res) != 'string') {
                    throw new Error(`File read error`);
                }
                return res;
            }
        } finally {
            f.close();
        }
    }

    platform.writeFile = function(path, content) {
        throw new Error("Not implemented");
    }

    platform.info = function() {
        return `QuickJS on ${os.platform}`;
    }

    if (typeof(console.error) === 'undefined') {
        console.error = function(...args) {
            let str = args.map(x => x.toString()).join(' ');
            std.err.puts(str + '\n');
        }
    }

    return platform;
})():

/* ------------------------------------ Unknown platform ------------------------------------ */
(function() {
    if (typeof(scriptArgs) == 'object') {
        throw new Error('Unknown platform. If you are running QuickJS, specify "--std" flag.');
    }
    throw new Error('Unknown platform');
})();

if (typeof(exports) === 'object') {
    exports._triwasm_platform_impl = _triwasm_platform_impl;
}
