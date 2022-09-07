// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import type { ExtensionContext } from "vscode";
import { commands } from "vscode";
import { HelloWorldCommand } from "./HelloWorldCommand";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
// arg: extension: ExtensionContext
export function activate(context: ExtensionContext): void {
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json

    const helloWorld = commands.registerCommand("tuleap.helloWorld", HelloWorldCommand);
    context.subscriptions.push(helloWorld);
}

// this method is called when your extension is deactivated or uninstalled
export function deactivate(): void {
    // Clean-up extension-specific things
}
