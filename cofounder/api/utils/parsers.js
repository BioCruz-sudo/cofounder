import yaml from "yaml";

async function extractBackticks({ text }) {
    if (!text || typeof text !== 'string') {
        console.error("utils/parsers:extractAndParse:error", new Error("> invalid : null or non-string input"));
        return null;
    }

    try {
        const lines = text.split("\n");
        const firstLineWithBackticksIndex = lines.findIndex((line) =>
            line.includes("```")
        );
        const lastBackticksIndex =
            lines.length -
            1 -
            lines
                .slice()
                .reverse()
                .findIndex((line) => line.includes("```"));

        // Enhanced validation
        if (firstLineWithBackticksIndex === -1) {
            throw new Error("> invalid : no opening backticks found");
        }
        if (lastBackticksIndex === -1) {
            throw new Error("> invalid : no closing backticks found");
        }
        if (lastBackticksIndex <= firstLineWithBackticksIndex) {
            throw new Error("> invalid : malformed backtick structure");
        }

        const extractedContent = lines
            .slice(firstLineWithBackticksIndex + 1, lastBackticksIndex)
            .join("\n")
            .trim();

        if (!extractedContent) {
            throw new Error("> invalid : empty content between backticks");
        }

        return { text: extractedContent };
    } catch (error) {
        console.error("utils/parsers:extractAndParse:error", error);
        return null;
    }
}

async function extractBackticksMultiple({ text, delimiters }) {
    if (!text || !Array.isArray(delimiters) || delimiters.length === 0) {
        console.error("utils/parsers:extractAndParse:error", new Error("> invalid : missing text or delimiters"));
        return null;
    }

    try {
        let found = {};
        let cursor = 0;
        const lines = text.split("\n");

        for (let delim of delimiters) {
            if (cursor >= lines.length) break;

            const firstLine = lines
                .slice(cursor)
                .findIndex((line) => line.includes(`\`\`\`${delim}`));
            
            if (firstLine === -1) {
                console.warn(`Warning: No opening backticks found for delimiter "${delim}"`);
                continue;
            }

            const textFromFirstLine = lines.slice(cursor).slice(firstLine);
            const lastLine = textFromFirstLine
                .slice(1)
                .findIndex((line) => line.includes("```"));

            if (lastLine === -1) {
                console.warn(`Warning: No closing backticks found for delimiter "${delim}"`);
                continue;
            }

            found[delim] = textFromFirstLine.slice(1, lastLine + 1).join(`\n`);
            cursor = cursor + firstLine + lastLine + 2; // +2 to account for the closing backticks
        }

        return Object.keys(found).length > 0 ? found : null;
    } catch (error) {
        console.error("utils/parsers:extractAndParse:error", error);
        return null;
    }
}

async function parseYaml({ generated, query }) {
    if (!generated || !generated.text) {
        console.error("utils/parsers:parseYaml:error", new Error("> invalid : null or missing text in generated content"));
        return null;
    }

    try {
        const { text } = generated;
        const parsed = yaml.parse(text);
        
        if (parsed === null || parsed === undefined) {
            throw new Error("> invalid : YAML parsing resulted in null or undefined");
        }

        return parsed;
    } catch (error) {
        console.error("utils/parsers:parseYaml:error", error);
        return null;
    }
}

async function editGenUi({ tsx }) {
    if (!tsx) {
        console.error("utils/parsers:editGenUi:error", new Error("> invalid : null or missing tsx input"));
        return { tsx: "", ids: { sections: false, views: false } };
    }

    try {
        const genUi = {
            sections: false,
            views: false,
        };

        let newTsx = tsx
            .split(`\n`)
            .filter((line) => {
                if (!line) return true;
                
                if (line.includes(`@/components/sections/`)) {
                    if (!genUi.sections) genUi.sections = [];
                    const sectionId = line.split(` `)[1];
                    if (sectionId) {
                        genUi.sections = [...new Set([...genUi.sections, sectionId])];
                    }
                    return false;
                }
                if (line.includes(`@/components/views/`)) {
                    if (!genUi.views) genUi.views = [];
                    const viewId = line.split(` `)[1];
                    if (viewId) {
                        genUi.views = [...new Set([...genUi.views, viewId])];
                    }
                    return false;
                }
                return true;
            })
            .join(`\n`);

        if (genUi.sections) {
            newTsx = `import GenUiSection from '@/p0/genui/GenUiSection';\n${newTsx}`;
            for (let sectionId of genUi.sections) {
                newTsx = newTsx.replaceAll(
                    `<${sectionId}`,
                    `<GenUiSection id="${sectionId}"`
                );
            }
        }
        if (genUi.views) {
            newTsx = `import GenUiView from '@/p0/genui/GenUiView';\n${newTsx}`;
            for (let viewId of genUi.views) {
                newTsx = newTsx.replaceAll(
                    `<${viewId}`,
                    `<GenUiView id="${viewId}"`
                );
            }
        }

        return { tsx: newTsx, ids: genUi };
    } catch (error) {
        console.error("utils/parsers:editGenUi:error", error);
        return { tsx, ids: { sections: false, views: false } };
    }
}

async function extractCodeDecorators({ code }) {
    if (!code) {
        console.error("utils/parsers:extractCodeDecorators:error", new Error("> invalid : null or missing code input"));
        return [];
    }

    try {
        const { pre, post } = { pre: 5, post: 15 };
        const decorators = [];
        const lines = code.split("\n");

        lines.forEach((line, index) => {
            const decoratorMatch = line.match(/@need:([^:]+):(.+)/);
            if (decoratorMatch) {
                const type = decoratorMatch[1]?.trim();
                const description = decoratorMatch[2]?.trim();

                if (!type || !description) {
                    console.warn("Invalid decorator format at line:", index + 1);
                    return;
                }

                const startLine = Math.max(0, index - pre);
                const endLine = Math.min(lines.length, index + post + 1);
                const snippet =
                    "{/*...*/}\n" + lines.slice(startLine, endLine).join("\n") + "\n{/*...*/}";

                decorators.push({
                    type,
                    description,
                    snippet,
                    lineNumber: index + 1
                });
            }
        });

        return decorators;
    } catch (error) {
        console.error("utils/parsers:extractCodeDecorators:error", error);
        return [];
    }
}

export default {
    extract: {
        backticks: extractBackticks,
        backticksMultiple: extractBackticksMultiple,
        decorators: extractCodeDecorators,
    },
    parse: {
        yaml: parseYaml,
    },
    edit: {
        genUi: editGenUi,
    },
};
