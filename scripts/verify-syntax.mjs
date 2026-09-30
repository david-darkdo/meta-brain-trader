import fs from "fs";
import path from "path";
import ts from "typescript";

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach((f) => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== "node_modules" && f !== ".git" && f !== ".output" && f !== "dist") {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

console.log("============================================================");
console.log("COMPREHENSIVE SYNTAX & PARSE VERIFICATION");
console.log("============================================================");

const tsConfigPath = path.resolve("./tsconfig.json");
const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  path.dirname(tsConfigPath)
);

let allFiles = [];
walkDir("./src", (filePath) => {
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
    allFiles.push(filePath);
  }
});

console.log(`Found ${allFiles.length} TypeScript/TSX source files.`);

let parseErrors = 0;

for (const file of allFiles) {
  const content = fs.readFileSync(file, "utf-8");
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.ESNext,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  // Check for parse diagnostics
  const diagnostics = sourceFile.parseDiagnostics || [];
  if (diagnostics.length > 0) {
    parseErrors += diagnostics.length;
    console.error(`❌ Parse error in ${file}:`);
    for (const d of diagnostics) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(d.start);
      const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      console.error(`   [Line ${line + 1}, Col ${character + 1}]: ${message}`);
    }
  }
}

if (parseErrors === 0) {
  console.log("✅ All TS/TSX source files parsed with ZERO syntax errors!");
} else {
  console.error(`❌ Found ${parseErrors} syntax errors.`);
  process.exit(1);
}
