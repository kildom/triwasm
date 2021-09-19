@echo off
rustc --version
IF NOT ERRORLEVEL 1 GOTO skip_path
PATH=C:\Users\Dominik\.cargo\bin;C:\msys64\mingw64\bin;C:\msys64\usr\local\bin;C:\msys64\usr\bin;C:\msys64\usr\bin;%PATH%;C:\msys64\usr\bin\site_perl;C:\msys64\usr\bin\vendor_perl;C:\msys64\usr\bin\core_perl
:skip_path

:: rustup target add wasm32-unknown-unknown
:: rustup target add wasm32-wasi
:: https://users.rust-lang.org/t/export-functions-from-wasm-library-w-o-using-wasm-bindgen/51778/2

rustc test.rs --target wasm32-unknown-unknown -C opt-level=z -C lto -C link-args="-z stack-size=65536" -C link-args=--stack-first
