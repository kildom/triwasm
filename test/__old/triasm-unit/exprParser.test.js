const System = (function () {
    const System = {};
    const modules = {};
    System.register = function (name, deps, factory) {
    };
    return System;
})();
System.register("exprParser.test", [], function (exports_1, context_1) {
    "use strict";
    var x;
    var __moduleName = context_1 && context_1.id;
    function a() { return x; }
    exports_1("a", a);
    function b() { x++; }
    exports_1("b", b);
    return {
        setters: [],
        execute: function () {
            x = 0;
            ;
            ;
        }
    };
});
