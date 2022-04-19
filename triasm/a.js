



class Eval {

    constructor() {
        this.vars = {};
        this.vars['a'] = 1;
        this.vars['b'] = 13;
    }

    evalAdd(a, b) { return () => a() + b(); }
    evalSub(a, b) { return () => a() - b(); }
    evalMul(a, b) { return () => a() * b(); }
    evalValue(a) { return () => a; }
    evalVar(name) { return () => this.getVar(name); }
    evalCall(name, args) { return () => this[name](...(args.map(x => x()))); }

    createEvaluator(obj) {
        switch (obj.op) {
            case '+': return this.evalAdd(this.createEvaluator(obj.a), this.createEvaluator(obj.b));
            case '-': return this.evalSub(this.createEvaluator(obj.a), this.createEvaluator(obj.b));
            case '*': return this.evalMul(this.createEvaluator(obj.a), this.createEvaluator(obj.b));
            case 'int': return this.evalValue(obj.value);
            case 'var': return this.evalVar(obj.name);
            case 'call': return this.evalCall(`asm_${obj.name}`, obj.args.map(x => this.createEvaluator(x)));
            default: throw 'err' + obj.op;
        }
    }

    getVar(name) {
        return this.vars[name];
    }

    asm_mod(a, b) {
        console.log(a, b);
        return a % b;
    }
}

let expr = {
    op: '*',
    a: {
        op: 'int',
        value: 2,
    },
    b: {
        op: 'call', name: 'mod', args: [
            {
                op: 'var',
                name: 'a',
            },
            {
                op: 'int',
                value: 10,
            }
        ]
    },
};

let e = new Eval();

let evaluator = e.createEvaluator(expr);

console.log(evaluator());
e.vars.a = 18;
console.log(evaluator());

