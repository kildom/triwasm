#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

find_node() {
	find_inner() {
		set +e
		"$1" --version 2> /dev/null > /dev/null
		result=$?
		set -e
		if [ $result == 0 ]; then
			ENGINE_BIN=$1
			return 1
		else
			return 0
		fi
	}
	trap 'return 0' ERR
	ENGINE_ARGS=
	find_inner $SCRIPT_DIR/../ext/electron/electron
	for f in $SCRIPT_DIR/../ext/electron/*; do find_inner $f/electron; done
	find_inner $SCRIPT_DIR/../ext/node/node
	for f in $SCRIPT_DIR/../ext/node/*; do find_inner $f/node; done
	ENGINE_ARGS="run --allow-read --allow-write"
	find_inner $SCRIPT_DIR/../ext/deno
	find_inner $SCRIPT_DIR/../ext/deno/deno
	for f in $SCRIPT_DIR/../ext/deno/*; do find_inner $f/deno; find_inner $f; done
	ENGINE_ARGS=
	find_inner electron
	find_inner node-
	ENGINE_ARGS="run --allow-read --allow-write"
	find_inner deno
	find_inner $HOME/.deno/bin/deno
	>&2 echo
	>&2 echo "Cannot find any JavaScript engine."
	>&2 echo
	>&2 echo "For both GUI and CLI tools:"
	>&2 echo "  * Download Electron from https://github.com/electron/electron/releases/latest"
	>&2 echo "    and extract archive to" `realpath $SCRIPT_DIR/../ext/electron`/
	>&2 echo
	>&2 echo "For CLI-only tools, you can choose one of following options:"
	>&2 echo "  * Download Node.js from https://nodejs.org/en/download/ and install it"
	>&2 echo "    or extract archive to" `realpath $SCRIPT_DIR/../ext/node`/
	>&2 echo "  * Install Deno using instructions from"
	>&2 echo "    https://deno.land/manual/getting_started/installation"
    >&2 echo "  * Download Deno from https://github.com/denoland/deno/releases/latest"
	>&2 echo "    and extract archive to" `realpath $SCRIPT_DIR/../ext/deno`/
	>&2 echo
	>&2 echo "If you have any of above tools on your system, make sure that it is available"
    >&2 echo "on PATH environment variable."
	>&2 echo
	exit 99
}

set -e
find_node
trap - ERR
$ENGINE_BIN $ENGINE_ARGS $SCRIPT_DIR/js/`basename $0`.js "$@"
