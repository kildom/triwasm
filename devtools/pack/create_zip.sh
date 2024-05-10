#!/bin/bash
set -e

mkdir -p temp/dist
cd temp/pack
rm ../dist/trivm-sdk-v$2-$1.zip || true
rm ../dist/trivm-sdk-v$2-$1.7z || true
if [[ "$3" == "7z" ]]; then
    7z a -t7z -m0=lzma2 -mx=9 -mfb=64 -md=64m -ms=on ../dist/trivm-sdk-v$2-$1.7z *
else
    zip -9 -r ../dist/trivm-sdk-v$2-$1.zip *
fi
