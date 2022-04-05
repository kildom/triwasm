
// General parser settings
%name                                 LemonParse
%token_prefix                         LEMON_
%stack_size                           2000
%include                              { #include "lemonParser.h" }
%extra_context                        { Lemon* th }
%syntax_error                         { lemonError(th); }
%stack_overflow                       { lemonStackOverflow(th); }
%parse_failure                        { lemonFailure(th); }
%token_type                           { LemonToken }

// Root parsing symbol
root ::= prog(A).                     { lemonResult(th, &A); }

// Program - list of lines
%type prog                            { LemonProg }
%destructor prog                      { lemonProgFree(&$$); }
prog(R) ::= prog(A) line(B).          { R = lemonProgAppend(&A, B); }
prog(R) ::= .                         { R = lemonProgCreate(); }

// Line - command or empty line
%type line                            { LemonCommand* }
%destructor line                      { lemonCommandFree($$); }
line(R) ::= command(A) EOL.           { R = A; }
line(R) ::= EOL.                      { R = NULL; }

// Command - instruction, label or assignment
%type command                         { LemonCommand* }
%destructor command                   { lemonCommandFree($$); }
command(R) ::= INSTRUCTION(A).        { R = lemonInstrCreate(&A, NULL); }
command(R) ::= INSTRUCTION(A) args(B).{ R = lemonInstrCreate(&A, &B); }
command(R) ::= PRAGMA STRING(A).      { R = lemonPragmaCreate(&A); }
command(R) ::= id(A) COLON.           { R = lemonLabelCreate(&A); }
command(R) ::= id(A) ASSIGN expr(B).  { R = lemonAssignCreate(&A, B); }

// Arguments - comma-separated list of expressions
%type args                            { LemonArgs }
%destructor args                      { lemonArgsFree(&$$); }
args(R) ::= argsnc(A).                { R = A; }
args(R) ::= argsnc(A) COMMA.          { R = A; }
%type argsnc                          { LemonArgs }
%destructor argsnc                    { lemonArgsFree(&$$); }
argsnc(R) ::= argsnc(A) COMMA expr(B).{ R = lemonArgsAppend(&A, B); }
argsnc(R) ::= expr(A).                { R = lemonArgsCreate(A); }

// Identifier - in general it may have the same name as instruction or base register
%type id                              { LemonToken }
id(R) ::= IDENTIFIER(A).              { R = A; }
id(R) ::= INSTRUCTION(A).             { R = A; }
id(R) ::= BASE(A).                    { R = A; }
id(R) ::= PRAGMA(A).                  { R = A; }

// Expressions
%type expr                            { LemonExpr* }
%destructor expr                      { lemonExprFree($$); }

// Ternary operator
%nonassoc QUESTION.
expr(R) ::= expr(A) QUESTION expr(B) COLON expr(C).
                                      { R = lemonExprTernary(A, B, C); }

// Logical and bit operators
%left OR.
expr(R) ::= expr(A) OR expr(B).       { R = lemonExprBinOp('O', A, B); }
%left AND.
expr(R) ::= expr(AA) AND expr(BB).    { R = lemonExprBinOp('A', AA, BB); }
%left BIT_OR.
expr(R) ::= expr(A) BIT_OR expr(B).   { R = lemonExprBinOp('|', A, B); }
%left BIT_XOR.
expr(R) ::= expr(A) BIT_XOR expr(B).  { R = lemonExprBinOp('^', A, B); }
%left BIT_AND.
expr(R) ::= expr(A) BIT_AND expr(B).  { R = lemonExprBinOp('&', A, B); }

// Comparison operators
%left EQ NE.
expr(R) ::= expr(A) EQ expr(B).       { R = lemonExprBinOp('E', A, B); }
expr(R) ::= expr(A) NE expr(B).       { R = lemonExprBinOp('N', A, B); }
%left LT GT LE GE.
expr(R) ::= expr(A) LT expr(B).       { R = lemonExprBinOp('<', A, B); }
expr(R) ::= expr(A) GT expr(B).       { R = lemonExprBinOp('>', A, B); }
expr(R) ::= expr(A) LE expr(B).       { R = lemonExprBinOp('L', A, B); }
expr(R) ::= expr(A) GE expr(B).       { R = lemonExprBinOp('G', A, B); }

// Shift operators
%left SHL SHR.
expr(R) ::= expr(A) SHL expr(B).      { R = lemonExprBinOp('r', A, B); }
expr(R) ::= expr(A) SHR expr(B).      { R = lemonExprBinOp('l', A, B); }

// Arithmetic operators
%left PLUS MINUS.
expr(R) ::= expr(A) PLUS expr(B).     { R = lemonExprBinOp('+', A, B); }
expr(R) ::= expr(A) MINUS expr(B).    { R = lemonExprBinOp('-', A, B); }
%left MUL DIV MOD.
expr(R) ::= expr(A) MUL expr(B).      { R = lemonExprBinOp('*', A, B); }
expr(R) ::= expr(A) DIV expr(B).      { R = lemonExprBinOp('/', A, B); }
expr(R) ::= expr(A) MOD expr(B).      { R = lemonExprBinOp('%', A, B); }

// Unary operators
%right NOT BIT_NOT.
expr(R) ::= PLUS expr(A).  [NOT]      { R = A; }
expr(R) ::= MINUS expr(A). [NOT]      { R = lemonExprUnOp('M', A); }
expr(R) ::= NOT expr(A).              { R = lemonExprUnOp('!', A); }
expr(R) ::= BIT_NOT expr(A).          { R = lemonExprUnOp('~', A); }

// Function call
expr(R) ::= id(A) OPEN args(B) CLOSE. { R = lemonExprCall(&A, &B); }
expr(R) ::= id(A) OPEN CLOSE.         { R = lemonExprCall(&A, NULL); }

// Brackets
expr(R) ::= OPEN expr(A) CLOSE.       { R = A; }

// Expressions terminals
expr(R) ::= DECIMAL(A).               { R = lemonExprNumber(&A, 10); }
expr(R) ::= HEX(A).                   { R = lemonExprNumber(&A, 16); }
expr(R) ::= OCT(A).                   { R = lemonExprNumber(&A, 8); }
expr(R) ::= id(A).                    { R = lemonExprIdentifier(&A); }
expr(R) ::= SOPEN BASE(A) SCLOSE.     { R = lemonExprBase(&A); }
