@echo off

call :find_node %~dp0..\ext\electron\electron                      && goto node_found
for /r %%i in (%~dp0..\ext\electron\*) do set TEST_DIR=%%i
call :find_node %TEST_DIR%\electron                                && goto node_found
call :find_node %~dp0..\ext\node\node                              && goto node_found
for /r %%i in (%~dp0..\ext\node\*) do set TEST_DIR=%%i
call :find_node %TEST_DIR%\node                                    && goto node_found
call :find_node electron                                           && goto node_found
call :find_node node                                               && goto node_found
call :find_node "%ProgramFiles%\nodejs\node"                       && goto node_found
call :find_node "%ProgramFiles(x86)%\nodejs\node"                  && goto node_found

call :show_message %~dp0..\ext\node\ %~dp0..\ext\electron\
exit /b 99

:show_message
echo. 1>&2
echo Cannot find any JavaScript engine. 1>&2
echo. 1>&2
echo For both GUI and CLI tools: 1>&2
echo     Download Electron from https://github.com/electron/electron/releases/latest 2>&1
echo     and extract archive to %~dpn2 2>&1
echo. 1>&2
echo For CLI-only tools: 1>&2
echo     Download Node.js from https://nodejs.org/en/download/ and install on your system 2>&1
echo     or extract archive to %~dpn1 2>&1
echo. 1>&2
echo If you have any of above, make sure that it is available on PATH environment variable. 2>&1
goto :eof

:find_node
"%~1" --version > nul 2> nul
if ERRORLEVEL 1 goto :EOF
set NODE_BIN="%~1"
goto :EOF

:node_found
%NODE_BIN% "%~dp0js\%~n0.js" %*
exit /b %ERRORLEVEL%
