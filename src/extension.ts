// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import type { QuickPickItem, Disposable, QuickInputButton, QuickInput } from "vscode";
import {
    window,
    //CancellationToken,
    //ExtensionContext,
    QuickInputButtons,
    Uri,
} from "vscode";

interface State {
    title: string;
    step: number;
    totalSteps: number;
    resourceGroup: QuickPickItem | undefined;
    name: string;
    runtime: QuickPickItem;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json

    //TODO: dispose of this command in deactivate function
    vscode.commands.registerCommand("tuleap.helloWorld", () => {
        const resourceGroups: QuickPickItem[] = [];

        // TODO make this relative
        const inputAsWorkspaceRelativeFolder = './custom_folder';

        fs.readdir(inputAsWorkspaceRelativeFolder, (err, files: string[]) => {
            files.forEach((file) => {
                const uri = vscode.Uri.file(file);
                resourceGroups.push({ label: uri.path });
            });

            class MyButton implements QuickInputButton {
                constructor(public iconPath: { light: Uri; dark: Uri }, public tooltip: string) {}
            }

            const createResourceGroupButton = new MyButton(
                {
                    dark: Uri.file(context.asAbsolutePath("resources/dark/add.svg")),
                    light: Uri.file(context.asAbsolutePath("resources/light/add.svg")),
                },
                "Create Resource Group"
            );

            async function collectInputs(): Promise<void> {
                const state: Partial<State> = {};
                await MultiStepInput.run((input) => pickResourceGroup(input, state));
            }

            collectInputs();

            const title = "Send file to Tuleap";

            async function pickResourceGroup(
                input: MultiStepInput,
                state: Partial<State>
            ): Promise<InputStep> {
                const pick = await input.showQuickPick({
                    title,
                    step: 1,
                    totalSteps: 3,
                    placeholder: "Pick a file to send to Tuleap",
                    items: resourceGroups,
                    activeItem: state.resourceGroup,
                    buttons: [createResourceGroupButton],
                    shouldResume: shouldResume,
                });
                if (pick instanceof MyButton) {
                    return (input: MultiStepInput) => inputChooseArtifact(input);
                }
                return (input: MultiStepInput) => inputChooseArtifact(input);
            }

            async function inputChooseArtifact(input: MultiStepInput): Promise<InputStep> {
                await input.showInputBox({
                    title,
                    step: 2,
                    totalSteps: 4,
                    value: "",
                    prompt: "Enter your artifact id",
                    validate: validateIsANumber,
                    shouldResume: shouldResume,
                });
                return () => uploadFileToTuleap();
            }

            async function uploadFileToTuleap(): Promise<void> {
                // TODO call api
                console.log("should call a rest upload file");
                await undefined;
            }

            function shouldResume(): Promise<boolean> {
                // Could show a notification with the option to resume.
                return new Promise<boolean>(() => {
                    // noop
                });
            }

            async function validateIsANumber(name: string): Promise<string | undefined> {
                // TODO check is KO validation is not done
                // ...validate...
                await new Promise((resolve) => setTimeout(resolve, 1000));
                console.log(name);
                return name === "0123456789" ? "Artifact id must be a number" : undefined;
            }
        });
    });
}

// this method is called when your extension is deactivated
export function deactivate(): void {
    // Do nothing
}

// -------------------------------------------------------
// Helper code that wraps the API for the multi-step case.
// -------------------------------------------------------

class InputFlowAction {
    static back = new InputFlowAction();
    static cancel = new InputFlowAction();
    static resume = new InputFlowAction();
}

type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;

interface QuickPickParameters<T extends QuickPickItem> {
    title: string;
    step: number;
    totalSteps: number;
    items: T[];
    activeItem?: T;
    placeholder: string;
    buttons?: QuickInputButton[];
    shouldResume: () => Thenable<boolean>;
}

interface InputBoxParameters {
    title: string;
    step: number;
    totalSteps: number;
    value: string;
    prompt: string;
    validate: (value: string) => Promise<string | undefined>;
    buttons?: QuickInputButton[];
    shouldResume: () => Thenable<boolean>;
}

class MultiStepInput {
    static run(start: InputStep): Promise<void> {
        const input = new MultiStepInput();
        return input.stepThrough(start);
    }

    private current?: QuickInput;
    private steps: InputStep[] = [];

    private async stepThrough(start: InputStep): Promise<void> {
        let step: InputStep | void = start;
        while (step) {
            this.steps.push(step);
            if (this.current) {
                this.current.enabled = false;
                this.current.busy = true;
            }
            try {
                step = await step(this);
            } catch (err) {
                if (err === InputFlowAction.back) {
                    this.steps.pop();
                    step = this.steps.pop();
                } else if (err === InputFlowAction.resume) {
                    step = this.steps.pop();
                } else if (err === InputFlowAction.cancel) {
                    step = undefined;
                } else {
                    throw err;
                }
            }
        }
        if (this.current) {
            this.current.dispose();
        }
    }

    async showQuickPick({
        title,
        step,
        totalSteps,
        items,
        activeItem,
        placeholder,
        buttons,
        shouldResume,
    }: QuickPickParameters<QuickPickItem>): Promise<QuickPickItem | QuickInputButton> {
        const disposables: Disposable[] = [];
        try {
            return await new Promise<QuickPickItem | QuickInputButton>((resolve, reject) => {
                const input = window.createQuickPick();
                input.title = title;
                input.step = step;
                input.totalSteps = totalSteps;
                input.placeholder = placeholder;
                input.items = items;
                if (activeItem) {
                    input.activeItems = [activeItem];
                }
                input.buttons = [
                    ...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
                    ...(buttons || []),
                ];
                disposables.push(
                    input.onDidTriggerButton((item) => {
                        if (item === QuickInputButtons.Back) {
                            reject(InputFlowAction.back);
                        } else {
                            resolve(item);
                        }
                    }),
                    input.onDidChangeSelection((items) => resolve(items[0])),
                    input.onDidHide(() => {
                        (async (): Promise<void> => {
                            reject(
                                shouldResume && (await shouldResume())
                                    ? InputFlowAction.resume
                                    : InputFlowAction.cancel
                            );
                        })().catch(reject);
                    })
                );
                if (this.current) {
                    this.current.dispose();
                }
                this.current = input;
                this.current.show();
            });
        } finally {
            disposables.forEach((d) => d.dispose());
        }
    }

    async showInputBox({
        title,
        step,
        totalSteps,
        value,
        prompt,
        validate,
        buttons,
        shouldResume,
    }: InputBoxParameters): Promise<string | QuickInputButton> {
        const disposables: Disposable[] = [];
        try {
            return await new Promise<string | QuickInputButton>((resolve, reject) => {
                const input = window.createInputBox();
                input.title = title;
                input.step = step;
                input.totalSteps = totalSteps;
                input.value = value || "";
                input.prompt = prompt;
                input.buttons = [
                    ...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
                    ...(buttons || []),
                ];
                let validating = validate("");
                disposables.push(
                    input.onDidTriggerButton((item) => {
                        if (item === QuickInputButtons.Back) {
                            reject(InputFlowAction.back);
                        } else {
                            resolve(item);
                        }
                    }),
                    input.onDidAccept(async () => {
                        const value = input.value;
                        input.enabled = false;
                        input.busy = true;
                        if (!(await validate(value))) {
                            resolve(value);
                        }
                        input.enabled = true;
                        input.busy = false;
                    }),
                    input.onDidChangeValue(async (text) => {
                        const current = validate(text);
                        validating = current;
                        const validationMessage = await current;
                        if (current === validating) {
                            input.validationMessage = validationMessage;
                        }
                    }),
                    input.onDidHide(() => {
                        (async (): Promise<void> => {
                            reject(
                                shouldResume && (await shouldResume())
                                    ? InputFlowAction.resume
                                    : InputFlowAction.cancel
                            );
                        })().catch(reject);
                    })
                );
                if (this.current) {
                    this.current.dispose();
                }
                this.current = input;
                this.current.show();
            });
        } finally {
            disposables.forEach((d) => d.dispose());
        }
    }
}
