// -------------------------------------------------------
// Helper code that wraps the API for the multi-step case.
// -------------------------------------------------------

// Note: this code is based on this file:
// https://github.com/microsoft/vscode-extension-samples/blob/main/quickinput-sample/src/multiStepInput.ts
// I spent a little effort to try and simplify it a little bit, as the avalanche of generics, classes, Promises, Promises-based control flow and State made it very difficult to understand.
// This code is still _way_ too clever-looking for what we really need. We should not reuse it as it stands, it would be safer to start from scratch.

import type { Disposable, QuickInput, QuickInputButton, QuickPickItem } from "vscode";
import { QuickInputButtons, window } from "vscode";

class InputFlowAction {
    static back = new InputFlowAction();
    static cancel = new InputFlowAction();
    static resume = new InputFlowAction();
}

export type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;

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

export class MultiStepInput {
    static run(start: InputStep): Thenable<void> {
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
        this.current?.dispose();
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
                const quickPick = window.createQuickPick();
                quickPick.title = title;
                quickPick.step = step;
                quickPick.totalSteps = totalSteps;
                quickPick.placeholder = placeholder;
                quickPick.items = items;
                if (activeItem) {
                    quickPick.activeItems = [activeItem];
                }
                quickPick.buttons = [
                    ...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
                    ...(buttons || []),
                ];
                disposables.push(
                    quickPick.onDidTriggerButton((button) => {
                        if (button === QuickInputButtons.Back) {
                            reject(InputFlowAction.back);
                        }
                        resolve(button);
                    }),
                    quickPick.onDidChangeSelection((items) => resolve(items[0])),
                    quickPick.onDidHide(() => {
                        (async (): Promise<void> => {
                            reject(
                                shouldResume && (await shouldResume())
                                    ? InputFlowAction.resume
                                    : InputFlowAction.cancel
                            );
                        })().catch(reject);
                    })
                );
                this.current?.dispose();
                this.current = quickPick;
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
                    input.onDidTriggerButton((button) => {
                        if (button === QuickInputButtons.Back) {
                            reject(InputFlowAction.back);
                        } else {
                            resolve(button);
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
                this.current?.dispose();
                this.current = input;
                this.current.show();
            });
        } finally {
            disposables.forEach((d) => d.dispose());
        }
    }
}
