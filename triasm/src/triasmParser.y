
%include { #include "triasmParser.h" }

%nonassoc QUESTION.
%left BIT_OR.
%left BIT_AND.
%left MUL DIV MOD.
%left PLUS MINUS.

%name                                 LemonParse
%token_prefix                         LEMON_
%stack_size                           2000
%extra_context                        { Lemon* lemonState }
%syntax_error                         { lemonError(TOKEN); }
%stack_overflow                       { lemonStackOverflow(lemonState); }
%parse_failure                        { lemonFailure(lemonState); }
%token_type                           { LemonToken* }
%token_destructor                     { lemonTokenFree($$); }

%type start                           { void* }
%destructor start                     { }
start(R) ::= prog(A).                 { (void)R; lemonResult(A); }

%type prog                            { LemonProg* }
%destructor prog                      { lemonProgFree($$); }
prog(R) ::= prog(A) line(B).          { R = A; if (B != NULL) lemonProgAppend(A, B); }
prog(R) ::= .                         { R = lemonProgCreate(lemonState); }

%type line                            { LemonCommand* }
%destructor line                      { lemonCommandFree($$); }
line(R) ::= command EOL.              { R = A; }
line(R) ::= EOL.                      { R = NULL; }

%type command                         { LemonCommand* }
%destructor command                   { lemonCommandFree($$); }
command(R) ::= instr(A).              { R = lemonInstrCreate(A, NULL, NULL); }
command(R) ::= instr(A) args(B).      { R = lemonInstrCreate(A, B, NULL); }
command(R) ::= instr(A) strings(B).   { R = lemonInstrCreate(A, NULL, B); }
command(R) ::= id(A) COLON.           { R = lemonLabelCreate(A); }
command(R) ::= id(A) ASSIGN expr(B).  { R = lemonAssignCreate(A, B); }

%type strings                         { LemonToken* }
%destructor strings                   { lemonTokenFree($$); }
strings(R) ::= strings(A) STRING(B).  { R = A; lemonStringAppend(A, B); }
strings(R) ::= STRING(A).             { R = A; }

%type args                            { LemonArgs* }
%destructor args                      { lemonArgsFree($$); }
args(R) ::= args(A) COMMA expr(B).    { R = A; lemonArgsAppend(A, B); }
args(R) ::= expr(A).                  { R = lemonArgsCreate(lemonState); lemonArgsAppend(R, A); }

%type id                              { LemonToken* }
%destructor id                        { lemonTokenFree($$); }
id(R) ::= IDENTIFIER(A).              { R = A; }
id(R) ::= INSTRUCTION(A).             { R = A; }
id(R) ::= DIRECTIVE(A).               { R = A; }
id(R) ::= BASE(A).                    { R = A; }

%type instr                           { LemonToken* }
%destructor instr                     { lemonTokenFree($$); }
instr(R) ::= INSTRUCTION(A).          { R = A; }
instr(R) ::= DIRECTIVE(A).            { R = A; }

%type expr                            { LemonExpr* }
%destructor expr                      { lemonExprFree($$); }
expr(R) ::= NUMBER(A).                { R = lemonExprNumber(A); }
expr(R) ::= id(A).                    { R = lemonExprIdentifier(A); }
expr(R) ::= SOPEN BASE(A) SCLOSE.     { R = lemonExprBase(A); }
expr(R) ::= OPEN expr(A) CLOSE.       { R = A; }
expr(R) ::= expr(A) PLUS expr(B).     { R = lemonExprBinOp('+', A, B); }
expr(R) ::= expr(A) MINUS expr(B).    { R = lemonExprBinOp('-', A, B); }
expr(R) ::= MINUS expr(A).            { R = lemonExprUnOp('-', A); }
expr(R) ::= expr(A) MUL expr(B).      { R = lemonExprBinOp('*', A, B); }
expr(R) ::= expr(A) DIV expr(B).      { R = lemonExprBinOp('/', A, B); }
expr(R) ::= expr(A) MOD expr(B).      { R = lemonExprBinOp('%', A, B); }
expr(R) ::= id(A) OPEN args(B) CLOSE. { R = lemonExprCall(A, B); }
expr(R) ::= id(A) OPEN CLOSE.         { R = lemonExprCall(A, lemonArgsCreate(lemonState)); }
expr(R) ::= expr(A) QUESTION expr(B) COLON expr(C). { R = lemonExprTriOp(A, B, C); }
expr(R) ::= expr(A) BIT_AND expr(B).  { R = lemonExprBinOp('&', A, B); }

