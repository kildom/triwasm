

/**
 * Create template from the given string
 * @param text   Template text. "<%= ... %>" will output an expression value
 *               converted to a string using string concatenation.
 *               "<% ... %>" will execute a JavaScript. The 'output' is
 *               an array of strings containing the output.
 * @param params List of parameter names to pass to the template or actual
 *               object with parameters (Object.keys will get the names).
 *               It can be also a string if you want to pass one value to the template.
 * @returns      A function that takes one parameter with arguments and returns
 *               generated string.
 */
export function template(text: string, params: string | string[] | { [key: string]: any }): (params: any) => string {
    let code = ('%>' + text + '<%').replace(/%>([\s\S]*?)<%(?!=)/g, (_, m) => {
        let concat = ('%>' + m + '<%=').replace(/\s*%>([\s\S]*?)<%=\s*/g, (_, m2) => {
            return ')+' + JSON.stringify(m2) + '+(';
        });
        while (concat.at(-1) != '"') {
            concat = concat.substring(0, concat.length - 1);
        }
        while (concat[0] != '"') {
            concat = concat.substring(1);
        }
        return `output.push(${concat});`;
    });
    if (typeof (params) == 'string') {
        let func = new Function('output', params, code);
        return (p: any) => {
            let output: string[] = [];
            func(output, p);
            return output.join('');
        }
    } else {
        let paramsFixed = (params instanceof Array) ? params as string[] : Object.keys(params);
        let prefix = paramsFixed.map(name => `const ${name} = __PaRams__.${name};`).join('');
        code = prefix + code;
        let func = new Function('output', '__PaRams__', code);
        return (p: any) => {
            let output: string[] = [];
            func(output, p);
            return output.join('');
        }
    }
}
