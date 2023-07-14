@echo off

set MINIMUM_NODE_VER=1600
set MINIMUM_DENO_VER=100
set COMMAND_NAME=%0

call :get_dirs %~dp0 %~dp0\..

set LOG=rem
if "%1"=="--js-info" if "%2"=="" set LOG=echo
if "%1"=="--js-download" if "%2"=="" goto download

call :find_engine                                                                 || exit /b
%ENGINE_BIN% "%~dp0js\%~n0.js" %*
goto :EOF

:get_dirs
    set JS_DIR=%~dpnx1\js
    set EXT_DIR=%~dpnx2\ext
    goto :EOF

:download
    echo Downloading Deno...
    set DENO_INSTALL=%EXT_DIR%\deno
    :: TODO: Raise an issue in denoland/install_deno repository to add option that
    :: prevents from changing the PATH environment variable.
    powershell -command "irm https://deno.land/install.ps1 | iex"                 || exit /b
    echo Done.
    echo Version information:
    call :find_engine                                                             || exit /b
    echo %ENGINE_BIN%
    call :show_downloaded_ver %ENGINE_BIN%
    exit /b

:show_downloaded_ver
    %1 --version
    exit /b

:find_engine
    :: Electron in ext\
    call :check_node "%EXT_DIR%\electron\electron"                      && exit /b
    for /d %%i in ("%EXT_DIR%\electron\*") do set TEST_DIR=%%i
    call :check_node "%TEST_DIR%\electron"                              && exit /b
    :: Node.js in ext\
    call :check_node "%EXT_DIR%\node\node"                              && exit /b
    for /d %%i in ("%EXT_DIR%\node\*") do set TEST_DIR=%%i
    call :check_node "%TEST_DIR%\node"                                  && exit /b
    :: Deno in ext\
    call :check_deno "%EXT_DIR%\deno\bin\deno"                          && exit /b
    call :check_deno "%EXT_DIR%\deno\deno"                              && exit /b
    call :check_deno "%EXT_DIR%\deno"                                   && exit /b
    for /d %%i in ("%EXT_DIR%\deno\*") do set TEST_DIR=%%i
    call :check_deno "%TEST_DIR%\bin\deno"                              && exit /b
    call :check_deno "%TEST_DIR%\deno"                                  && exit /b
    :: QuickJS in ext\
    call :check_qjs "%EXT_DIR%\quickjs\qjs"                             && exit /b
    for /d %%i in ("%EXT_DIR%\quickjs\*") do set TEST_DIR=%%i
    call :check_qjs "%TEST_DIR%\qjs"                                    && exit /b
    :: Anything in PATH
    call :check_node electron                                           && exit /b
    call :check_node node                                               && exit /b
    call :check_deno deno                                               && exit /b
    call :check_qjs qjs                                                 && exit /b
    :: Anything in its default installation directory
    call :check_node "%ProgramFiles%\nodejs\node"                       && exit /b
    call :check_node "%ProgramFiles(x86)%\nodejs\node"                  && exit /b
    call :check_deno "%HOMEDRIVE%%HOMEPATH%\.deno\bin\deno"             && exit /b
    goto show_message

:check_node
    %LOG% Checking Node.js or Electron at: %1
    %1 "%JS_DIR%\versioncheck.js" %MINIMUM_NODE_VER% > nul 2> nul
    set RES=%ERRORLEVEL%
    set "ENGINE_BIN=--enable-source-maps --expose-gc"
    if %RES%==87 goto check_result_old
    if %RES%==86 goto check_result_ok
    goto check_result_error

:check_deno
    %LOG% Checking deno at: %1
    %1 run "%JS_DIR%\versioncheck.js" %MINIMUM_DENO_VER% > nul 2> nul
    set RES=%ERRORLEVEL%
    set "ENGINE_BIN=run --allow-read --allow-write"
    if %RES%==87 goto check_result_old
    if %RES%==86 goto check_result_ok
    goto check_result_error

:check_qjs
    %LOG% Checking QuickJS at: %1
    %1 --std -m -e std.exit(86) > nul 2> nul
    set RES=%ERRORLEVEL%
    set ENGINE_BIN=--std -m
    if %RES%==86 goto check_result_ok
    goto check_result_error

:check_result_ok
    set "ENGINE_BIN=%1 %ENGINE_BIN%"
    %LOG%     RESULT: OK
    exit /b 0

:check_result_error
    %LOG%     RESULT: Error
    exit /b 1

:check_result_old
    %LOG%     RESULT: Unsupported version
    exit /b 1

:show_message
    echo.
    echo Cannot find any JavaScript runtime.
    echo.
    echo Use the following command to automatically download Deno JavaScript runtime:
    echo     %COMMAND_NAME% --js-download
    if %LOG%==echo goto show_details
    echo.
    echo Use the following command to see more details:
    echo     %COMMAND_NAME% --js-info
    exit /b 99

:show_details
    echo.
    echo You need one of the following JavaScript runtimes to run this tool:
    echo   * Electron (https://www.electronjs.org/) - recommended for GUI tools
    echo   * Node.js (https://nodejs.org/)
    echo   * Deno (https://deno.land/)
    echo   * QuickJS (https://bellard.org/quickjs/) - only CLI tools
    echo.
    echo If you have any of the above runtimes on your system, make sure they are
    echo available on the PATH environment variable and they have supported version.
    echo.
    echo Installation tips:
    echo   * Electron
    echo     Download from https://github.com/electron/electron/releases/latest and
    echo     extract archive to %EXT_DIR%\electron
    echo   * Node.js
    echo     Download from https://nodejs.org/en/download/ and install it on your
    echo     system or extract archive to %EXT_DIR%\node
    echo   * Deno (user space installation)
    echo     The instructions on https://deno.land/manual/getting_started/installation
    echo     will guide you through simple installation process.
    echo   * Deno (local only installation)
    echo     Download Deno from https://github.com/denoland/deno/releases/latest
    echo     and extract archive to %EXT_DIR%\deno
    echo   * QuickJS
    echo     Download binaries from https://bellard.org/quickjs/binary_releases/ and
    echo     extract archive to %EXT_DIR%\quickjs
    exit /b 99
