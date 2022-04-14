
// General parser settings
%name                                 LemonParse
%token_prefix                         LEMON_
%stack_size                           2000
%include                              { #include "lemonParser.h" }
%extra_context                        { void* th }
%syntax_error                         { lemonError(th); }
%stack_overflow                       { lemonStackOverflow(th); }
%parse_failure                        { lemonFailure(th); }
%token_type                           { LemonToken }

// Root parsing symbol
root ::= prog.

// Program - list of lines
prog ::= prog line(B).                { lemonResultVerify(th, B); }
prog ::= .

// Line - command or empty line
%type line                            { int }
line(R) ::= command(A) EOL.           { R = A; }
line(R) ::= EOL.                      { R = -1; } // TODO: -1 to ignore the value during order verification

// Command - instruction, label or assignment
%type command                         { int } // TODO: new command returns incrementing counter for verification if instructions are added to program in a right order
command(R) ::= INSTRUCTION(A).        { R = lemonInstr(th, &A, 0); }
command(R) ::= INSTRUCTION(A) args(B).{ R = lemonInstr(th, &A, B); }
command(R) ::= PRAGMA STRING(A).      { R = lemonPragma(th, &A); }
command(R) ::= id(A) COLON.           { R = lemonLabel(th, &A); }
command(R) ::= id(A) ASSIGN expr(B).  { R = lemonAssign(th, &A, B); }

// Arguments - comma-separated list of expressions
%type args                            { int }
%destructor args                      { lemonArgsFree(th, $$); }
args(R) ::= argsnc(A).                { R = A; }
args(R) ::= argsnc(A) COMMA.          { R = A; }
%type argsnc                          { int }
%destructor argsnc                    { lemonArgsFree(th, $$); }
argsnc(R) ::= argsnc(A) COMMA expr(B).{ R = A; lemonArgsAppend(th, R, B); }
argsnc(R) ::= expr(A).                { R = lemonArgsCreate(th); lemonArgsAppend(th, R, A); }

// Identifier - in general it may have the same name as instruction or base register
%type id                              { LemonToken }
id(R) ::= IDENTIFIER(A).              { R = A; }
id(R) ::= INSTRUCTION(A).             { R = A; }
id(R) ::= BASE(A).                    { R = A; }
id(R) ::= PRAGMA(A).                  { R = A; }

// Expressions
%type expr                            { int }
%destructor expr                      { lemonExprFree(th, $$); }

// Ternary operator
%nonassoc QUESTION.
expr(R) ::= expr(A) QUESTION expr(B) COLON expr(C).
                                      { R = lemonExprTernary(th, A, B, C); }

// Logical and bit operators
%left OR.
expr(R) ::= expr(A) OR expr(B).       { R = lemonExprBinOp(th, 'O', A, B); }
%left AND.
expr(R) ::= expr(AA) AND expr(BB).    { R = lemonExprBinOp(th, 'A', AA, BB); }
%left BIT_OR.
expr(R) ::= expr(A) BIT_OR expr(B).   { R = lemonExprBinOp(th, '|', A, B); }
%left BIT_XOR.
expr(R) ::= expr(A) BIT_XOR expr(B).  { R = lemonExprBinOp(th, '^', A, B); }
%left BIT_AND.
expr(R) ::= expr(A) BIT_AND expr(B).  { R = lemonExprBinOp(th, '&', A, B); }

// Comparison operators
%left EQ NE.
expr(R) ::= expr(A) EQ expr(B).       { R = lemonExprBinOp(th, 'E', A, B); }
expr(R) ::= expr(A) NE expr(B).       { R = lemonExprBinOp(th, 'N', A, B); }
%left LT GT LE GE.
expr(R) ::= expr(A) LT expr(B).       { R = lemonExprBinOp(th, '<', A, B); }
expr(R) ::= expr(A) GT expr(B).       { R = lemonExprBinOp(th, '>', A, B); }
expr(R) ::= expr(A) LE expr(B).       { R = lemonExprBinOp(th, 'L', A, B); }
expr(R) ::= expr(A) GE expr(B).       { R = lemonExprBinOp(th, 'G', A, B); }

// Shift operators
%left SHL SHR.
expr(R) ::= expr(A) SHL expr(B).      { R = lemonExprBinOp(th, 'r', A, B); }
expr(R) ::= expr(A) SHR expr(B).      { R = lemonExprBinOp(th, 'l', A, B); }

// Arithmetic operators
%left PLUS MINUS.
expr(R) ::= expr(A) PLUS expr(B).     { R = lemonExprBinOp(th, '+', A, B); }
expr(R) ::= expr(A) MINUS expr(B).    { R = lemonExprBinOp(th, '-', A, B); }
%left MUL DIV MOD.
expr(R) ::= expr(A) MUL expr(B).      { R = lemonExprBinOp(th, '*', A, B); }
expr(R) ::= expr(A) DIV expr(B).      { R = lemonExprBinOp(th, '/', A, B); }
expr(R) ::= expr(A) MOD expr(B).      { R = lemonExprBinOp(th, '%', A, B); }

// Unary operators
%right NOT BIT_NOT.
expr(R) ::= PLUS expr(A).  [NOT]      { R = A; }
expr(R) ::= MINUS expr(A). [NOT]      { R = lemonExprUnOp(th, 'M', A); }
expr(R) ::= NOT expr(A).              { R = lemonExprUnOp(th, '!', A); }
expr(R) ::= BIT_NOT expr(A).          { R = lemonExprUnOp(th, '~', A); }

// Function call
expr(R) ::= id(A) OPEN args(B) CLOSE. { R = lemonExprCall(th, &A, B); }
expr(R) ::= id(A) OPEN CLOSE.         { R = lemonExprCall(th, &A, 0); }

// Brackets
expr(R) ::= OPEN expr(A) CLOSE.       { R = A; }

// Expressions terminals
expr(R) ::= DECIMAL(A).               { R = lemonExprNumber(th, &A, 10); }
expr(R) ::= HEX(A).                   { R = lemonExprNumber(th, &A, 16); }
expr(R) ::= OCT(A).                   { R = lemonExprNumber(th, &A, 8); }
expr(R) ::= id(A).                    { R = lemonExprIdentifier(th, &A); }
expr(R) ::= SOPEN BASE(A) SCLOSE.     { R = lemonExprBase(th, &A); }
