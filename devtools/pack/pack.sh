#!/bin/bash
set -e

ELECTRON_VERSION=v30.0.3
BINARYEN_VERSION=version_117
BAREMETAL_WASM_SDK_VERSION=22

main () {
    mkdir -p temp/downloads
    cd temp/downloads

    get_electron win32-x64 win32-x64
    #get_electron win32-arm64 win32-arm64 - not supported by wasi-sdk
    get_electron linux-x64 linux-x64
    #get_electron linux-arm64 linux-arm64 - not supported by wasi-sdk
    get_electron darwin-x64 macos-x64
    #get_electron darwin-arm64 macos-arm64 - not supported by wasi-sdk

    get_binaryen x86_64-windows win32-x64
    #get_binaryen arm64-windows win32-arm64 - not supported by binaryen
    get_binaryen x86_64-linux linux-x64
    #get_binaryen aarch64-linux linux-arm64 - not supported by wasi-sdk
    get_binaryen x86_64-macos macos-x64
    #get_binaryen arm64-macos macos-arm64 - not supported by wasi-sdk

    get_baremetal_wasm_sdk 0.m-mingw64 win32-x64
    get_baremetal_wasm_sdk 0-linux linux-x64
    get_baremetal_wasm_sdk 0-macos macos-x64

    cd ../..

    npx tsx devtools/pack/get_file_list.ts > temp/dist.sh
    chmod 755 temp/dist.sh
    temp/dist.sh
}

get_archive_common () {
    if [ ! -f OK-$1 ]; then
        rm -f $1 || true
        wget $2
        mv $1 OK-$1
    fi
    rm -Rf $3 || true
    mkdir -p $3
    cd $3
    $4 ../OK-$1
    cd ..
}

get_electron () {
    get_archive_common \
        electron-$ELECTRON_VERSION-$1.zip \
        https://github.com/electron/electron/releases/download/$ELECTRON_VERSION/electron-$ELECTRON_VERSION-$1.zip \
        electron-$ELECTRON_VERSION-$2 \
        unzip
}

get_binaryen () {
    get_archive_common \
        binaryen-$BINARYEN_VERSION-$1.tar.gz \
        https://github.com/WebAssembly/binaryen/releases/download/$BINARYEN_VERSION/binaryen-$BINARYEN_VERSION-$1.tar.gz \
        binaryen-$BINARYEN_VERSION-$2 \
        "tar -xzf"
}

get_baremetal_wasm_sdk () {
    get_archive_common \
        wasi-sdk-$BAREMETAL_WASM_SDK_VERSION.$1.tar.gz \
        https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-$BAREMETAL_WASM_SDK_VERSION/wasi-sdk-$BAREMETAL_WASM_SDK_VERSION.$1.tar.gz \
        wasi-sdk-$BAREMETAL_WASM_SDK_VERSION.$2 \
        "tar -xzf"
}

main
