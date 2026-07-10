const fs = require('fs');

const filename = process.argv[2] || 'index.js';
const content = fs.readFileSync(filename, 'utf8');

let depth = 0;
let line = 1;
let inString = null; // ' " ou `
let inLineComment = false;
let inBlockComment = false;
let inRegex = false;
let prevChar = '';

const stack = []; // pour tracer où chaque { a été ouvert

for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const next = content[i + 1];

    if (c === '\n') {
        line++;
        inLineComment = false;
        prevChar = c;
        continue;
    }

    if (inLineComment) { prevChar = c; continue; }
    if (inBlockComment) {
        if (prevChar === '*' && c === '/') inBlockComment = false;
        prevChar = c;
        continue;
    }
    if (inString) {
        if (c === '\\') { i++; prevChar = c; continue; } // skip escaped char
        if (c === inString) inString = null;
        prevChar = c;
        continue;
    }

    if (c === '/' && next === '/') { inLineComment = true; prevChar = c; continue; }
    if (c === '/' && next === '*') { inBlockComment = true; i++; prevChar = c; continue; }
    if (c === '"' || c === "'" || c === '`') { inString = c; prevChar = c; continue; }

    if (c === '{' || c === '(' || c === '[') {
        stack.push({ char: c, line });
    }
    if (c === '}' || c === ')' || c === ']') {
        const last = stack.pop();
        if (!last) {
            console.log(`❌ Fermeture "${c}" en trop à la ligne ${line}, sans ouverture correspondante !`);
        }
    }

    prevChar = c;
}

if (stack.length > 0) {
    console.log(`\n⚠️  ${stack.length} ouverture(s) jamais fermée(s) :\n`);
    stack.forEach(s => console.log(`   "${s.char}" ouvert à la ligne ${s.line} et jamais fermé`));
} else {
    console.log('✅ Toutes les accolades/parenthèses/crochets sont équilibrés.');
}