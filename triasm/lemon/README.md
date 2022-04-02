# triASM parser using Lemon

This directory contains triASM parser and everything what is needed to generate it using Lemon LALR(1) Parser Generator.

Contents of this directory:
* `lemonParser.y` - triASM syntax file, input for Lemon.
* `lemonParser.c` and `lemonParser.h` - source files of triASM parser auto-generated from `lemonParser.y` using the Lemon.
* `triasmParser.h` - C++ compatible header file to access the parser.
* `lemon.c` and `lempar.c` - source code the Lemon LALR(1) Parser Generator taken from SQLite project.
* `regenerate.sh` - bash script that compiles Lemon executable (`gcc` required) and regenerates parser source files.
* `updateLemon.js` - Node.js script that checks  SQLite repository on GitHub for a newer version of the Lemon.

The Lemon is in the public domain, so other files in this directory are also released in the public domain to keep the same princilpes.
