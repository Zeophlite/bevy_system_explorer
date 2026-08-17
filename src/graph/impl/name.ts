

// TODO: handle function names
// PropagateSet { _p: PhantomData<fn() -> bevy_ui::ui_node::ComputedUiTargetCamera> }
function parseRustName(name : string) : string {
    try {
        let tokens: Token[] = name.split(/(::|\,|\(|\)|<|>)/).filter(Boolean);
        // console.log("tokens", tokens);

        let leveledTokens = levelTokens(tokens);
        // console.log("leveledTokens", leveledTokens);
        let output = displayLeveledTokens(leveledTokens);
        // console.log("output", output);

        return output;
    } catch(ex) {
        console.warn("Unable to parsetRustName", name, ex);
        return name;
    }
}

type Token = string | "<" | ">" | "(" | ")" | "::" | ",";
type LeveledToken = string | "::" | "," | { type: string, tokens: LeveledToken[] };

function levelTokens(tokens: Token[]): { type: string, tokens: LeveledToken[] } {
    const root: { type: string, tokens: LeveledToken[] } = { type: "", tokens: [] };
    const stack: { type: string, tokens: LeveledToken[] }[] = [];

    let current = root;

    for (const token of tokens) {
        if (token === "<" || token === "(") {
            const newList: { type: string, tokens: LeveledToken[] } = { type: token, tokens: [] };

            current.tokens.push(newList);

            stack.push(current);

            current = newList;
        } else if (token === ">" || token === ")") {
            if (stack.length === 0) {
                throw new SyntaxError("Unexpected closing parenthesis '" + token + "'.");
            }

            let expectedOther = other(current.type);
            if(token != expectedOther) {
                throw new SyntaxError("Unexpected closing parenthesis '" + token + "', expected '" + expectedOther + "'.");
            }
            //   console.log("token " + token, current.type);

            handleCommas(current);

            current = stack.pop()!;
            //   console.log("current ", current.type);
        } else {
            current.tokens.push(token);
        }
    }

    if (stack.length > 0) {
        throw new SyntaxError("Missing closing parenthesis '" + other(current.type) + "'.");
    }

    return root;
}

function other(left: string): string {
    switch(left) {
        case "<":
            return ">";
        case "(":
            return ")";
        case ",":
            return "!";
    }

    throw new Error("Unexpected other: " + left);
}

function handleCommas(current: { type: string; tokens: LeveledToken[]; }) {
    // console.log("handleCommas", current);

    let commas: number[] = [];

    for(let [id, token] of current.tokens.entries()) {
        if(token == ",") {
            // console.log("Found comma");
            commas.push(id);
        }
    }

    if(commas.length > 0) {
        // console.log("Found commas", commas);
        let toks: LeveledToken[] = [];

        let startIdx = 0;

        while(true) {
            let comma = commas.shift();
            
            let val = current.tokens.slice(startIdx, comma);
            // console.log("val", val);
            toks.push({
                type: ",",
                tokens: val,
            });

            if(comma === undefined) {
                break;
            }
            startIdx = comma + 1;
        }

        current.tokens = toks;
    }
}

function displayLeveledTokens(input: { type: string, tokens: LeveledToken[] }) : string {
    let r = "";

    let first = true;

    for(let [id, token] of input.tokens.entries()) {
        if(typeof token == "string") {
            let peek = input.tokens.at(id+1);

            if(token != "::" && peek != "::") {
                r += token;
            }
        } else {
            if(token.type == ",") {
                if(!first) {
                    r += token.type;
                }

                r += displayLeveledTokens(token);
            } else {
                r += token.type + displayLeveledTokens(token) + other(token.type);
            }
        }

        first = false;
    }

    return r;
}

export function parseComponentName(componentName : string) : string {
    return parseRustName(componentName);
}

export function parseSystemName(systemName : string): string {
    return parseRustName(systemName);
}

export function parseSystemSetName(systemSetName : string): string {
    return parseRustName(systemSetName);
}

// let t = "bevy_transform::systems::propagate_transforms_for<bevy_ecs::query::filter::Or<(bevy_ecs::query::filter::With<bevy_gizmos::transform_gizmo::TransformGizmoRoot>, bevy_ecs::query::filter::With<bevy_gizmos_render::transform_gizmo_render::GizmoOverlayCamera>, bevy_ecs::query::filter::With<bevy_gizmos::transform_gizmo::TransformGizmoMeshMarker>)>>";
// let t = "A<B,C>"
// parseRustName(t);
// throw new Error();

