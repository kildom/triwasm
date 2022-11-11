

export class ObjMarker {
    private sym: symbol;
    public constructor(id: string) {
        this.sym = Symbol(id);
    }
    public set(obj: any) {
        obj[this.sym] = true;
    }
    public is(obj: any) {
        return !!obj[this.sym];
    }
    public clear(obj: any) {
        delete obj[this.sym];
    }
};
