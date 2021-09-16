#ifndef _REDUCER_HH_
#define _REDUCER_HH_

#include "Utils.hh"

#include "WasmData.hh"

DOLLAR_CLASS(Reducer);

class Reducer {
private:
    WasmModule$ mod;
    Array$$<WasmBlock$> blockStack;
    WasmFunction$ function;
    struct ReducerStack {
        Array$$<u32> stack;
        void push(u32 value);
        u32 pop();
        void pop(u32 count);
        ssize length();
        void clear();
        void remove(ssize start);
        void remove(ssize start, ssize end);
    };

    ReducerStack* stack;

public:
    void reduce(WasmModule$$ mod);
    void reduceFunction(WasmFunction$$ func);
    void reduceBlock(WasmBlock$ body);
    void reduceInstr(WasmInstr$ instr, Array$$<WasmInstr$> reduced);
};

#endif /* _REDUCER_HH_ */
