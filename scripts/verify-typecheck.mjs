import fs from "fs";
import path from "path";
import ts from "typescript";

console.log("============================================================");
console.log("FULL TYPESCRIPT COMPILER & SEMANTIC TYPECHECK VERIFICATION");
console.log("============================================================");

const tsConfigPath = path.resolve("./tsconfig.json");
const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  path.dirname(tsConfigPath)
);

const program = ts.createProgram({
  rootNames: parsedConfig.fileNames,
  options: parsedConfig.options,
});

const diagnostics = ts.getPreEmitDiagnostics(program);

if (diagnostics.length === 0) {
  console.log("✅ TypeScript Compilation: 0 errors! 100% CLEAN!");
} else {
  console.error(`❌ Found ${diagnostics.length} diagnostic error(s):`);
  for (const d of diagnostics) {
    if (d.file) {
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
      const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      console.error(`   ${d.file.fileName} [${line + 1}:${character + 1}]: ${message}`);
    } else {
      console.error(`   ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
    }
  }
  process.exit(1);
}
