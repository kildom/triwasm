import { EnabledExtensions, KNOWN_EXTENSIONS } from "../../tools/triasm/compiler";
import { platform } from "../../tools/utils/platform";
import { Template } from "../utils";


let input = platform.readFile('vectors.triasm', false);
let template = new Template(input);

let variants = 1 << KNOWN_EXTENSIONS.length;

for (let i = 0; i < variants; i++) {
    let ext: { [k: string]: boolean } = {};
    for (let k = 0; k < KNOWN_EXTENSIONS.length; k++) {
        ext[KNOWN_EXTENSIONS[k]] = !!(i & (1 << k));
    }
    let arg = { ext };
    template.dump();
    console.log(template.render(arg));
    platform.exit();
}
