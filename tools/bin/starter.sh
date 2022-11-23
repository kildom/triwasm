#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

MINIMUM_NODE_VER=1600
MINIMUM_DENO_VER=100

find_engine() {
    check_node() {
        $LOG "Checking Node.js or Electron at: $1"
        set +e
        "$1" -i <<< "process.exit(process.version.split('.').map(x=>parseInt(x.replace(/[^0-9]/,''))).slice(0,2).reduce((a,x)=>a=100*a+x)<$MINIMUM_NODE_VER?87:86)" 2> /dev/null > /dev/null
        result=$?
        set -e
        if [ $result == 87 ]; then
            $LOG "    RESULT: Unsupported version"
            return 0
        elif [ $result == 86 ]; then
            $LOG "    RESULT: OK"
            ENGINE_BIN=$1
            return 1
        else
            $LOG "    RESULT: Error"
            return 0
        fi
    }
    check_deno() {
        $LOG "Checking Deno at: $1"
        set +e
        "$1" <<< "Deno.exit(Deno.version.deno.split('.').map(x=>parseInt(x.replace(/[^0-9]/,''))).slice(0,2).reduce((a,x)=>a=100*a+x)<$MINIMUM_DENO_VER?87:86)" 2> /dev/null > /dev/null
        result=$?
        set -e
        if [ $result == 87 ]; then
            $LOG "    RESULT: Unsupported version"
            return 0
        elif [ $result == 86 ]; then
            $LOG "    RESULT: OK"
            ENGINE_BIN="$1 run --allow-read --allow-write"
            return 1
        else
            $LOG "    RESULT: Error"
            return 0
        fi
    }
    check_qjs() {
        $LOG "Checking QuickJS at: $1"
        set +e
        "$1" --std <<< "std.exit(86);" 2> /dev/null > /dev/null
        result=$?
        set -e
        if [ $result == 86 ]; then
            $LOG "    RESULT: OK"
            ENGINE_BIN="$1 --std"
            return 1
        else
            $LOG "    RESULT: Error"
            return 0
        fi
    }
    trap 'return 0' ERR
    check_node $SCRIPT_DIR/../ext/electron/electron
    for f in $SCRIPT_DIR/../ext/electron/*; do check_node $f/electron; done
    check_node $SCRIPT_DIR/../ext/node/node
    for f in $SCRIPT_DIR/../ext/node/*; do check_node $f/node; done
    check_deno $SCRIPT_DIR/../ext/deno/bin/deno
    check_deno $SCRIPT_DIR/../ext/deno/deno
    check_deno $SCRIPT_DIR/../ext/deno
    for f in $SCRIPT_DIR/../ext/deno/*; do
        check_deno $f/bin/deno
        check_deno $f/deno
        check_deno $f
    done
    check_qjs $SCRIPT_DIR/../ext/quickjs/qjs
    for f in $SCRIPT_DIR/../ext/quickjs/*; do check_qjs $f/qjs; done
    check_node electron
    check_node node
    check_deno deno
    check_qjs qjs
    check_deno $HOME/.deno/bin/deno
    >&2 echo
    >&2 echo "Cannot find any JavaScript runtime."
    >&2 echo
    >&2 echo "Use the following command to automatically download Deno JavaScript runtime:"
    >&2 echo "    $0 --js-download"
    >&2 echo
    if [ $LOG = "echo" ]; then
        >&2 echo "You need one of the following JavaScript runtimes to run this tool:
  * Electron (https://www.electronjs.org/) - recommended for GUI tools
  * Node.js (https://nodejs.org/)
  * Deno (https://deno.land/)
  * QuickJS (https://bellard.org/quickjs/) - only CLI tools

If you have any of the above runtimes on your system, make sure they are
available on the PATH environment variable and they have supported version.

Installation tips:
  * Electron
    Download from https://github.com/electron/electron/releases/latest and
    extract archive to `realpath $SCRIPT_DIR/../ext/electron`
  * Node.js
    Download from https://nodejs.org/en/download/ and install it on your
    system or extract archive to `realpath $SCRIPT_DIR/../ext/node`
  * Deno (user space installation)
    The instructions on https://deno.land/manual/getting_started/installation
    will guide you through simple installation process.
  * Deno (local only installation)
    Download Deno from https://github.com/denoland/deno/releases/latest
    and extract archive to `realpath $SCRIPT_DIR/../ext/deno`
  * QuickJS
    Download binaries from https://bellard.org/quickjs/binary_releases/ and
    extract archive to `realpath $SCRIPT_DIR/../ext/quickjs`
"
    else
        >&2 echo "Use the following command to see more details:"
        >&2 echo "    $0 --js-info"
        >&2 echo
    fi
    exit 99
}

set -e

if [ "$1" = "--js-info" ] && [ -z $2 ]; then
    LOG=echo
else
    LOG=:
fi

if [ "$1" = "--js-download" ] && [ -z $2 ]; then
    echo Downloading Deno...
    mkdir -p $SCRIPT_DIR/../ext/deno/tmp
    curl -fsSL https://deno.land/install.sh > $SCRIPT_DIR/../ext/deno/tmp/deno-install.sh
    DENO_INSTALL=$SCRIPT_DIR/../ext/deno sh $SCRIPT_DIR/../ext/deno/tmp/deno-install.sh > $SCRIPT_DIR/../ext/deno/tmp/deno-install.log
    echo Done.
    echo Version information:
    find_engine
    trap - ERR
    echo "$ENGINE_BIN"
    $ENGINE_BIN --version
    exit $?
fi

find_engine
trap - ERR

if [ $LOG != "echo" ]; then
    $ENGINE_BIN $SCRIPT_DIR/js/`basename $0`.js "$@"
fi
