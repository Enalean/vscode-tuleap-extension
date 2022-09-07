import type { QuickPickItem } from "vscode";
import { Uri } from "vscode";
import * as fs from "fs";
import type { InputStep } from "./MultiStepInput";
import { MultiStepInput } from "./MultiStepInput";

interface State {
    title: string;
    step: number;
    totalSteps: number;
    selectedFile: QuickPickItem;
    name: string;
    runtime: QuickPickItem;
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

export const HelloWorldCommand = (): void => {
    const quickPickItems: QuickPickItem[] = [];

    fs.readdir(".", (err, files: string[]) => {
        files.forEach((file) => {
            const uri = Uri.file(file);
            quickPickItems.push({ label: uri.path });
        });

        const title = "Send file to Tuleap";

        async function runMultiStep(): Promise<void> {
            const state: Partial<State> = {};
            await MultiStepInput.run((input) => pickAFile(input, state));
        }

        runMultiStep();

        async function pickAFile(input: MultiStepInput, state: Partial<State>): Promise<InputStep> {
            await input.showQuickPick({
                title,
                step: 1,
                totalSteps: 3,
                placeholder: "Pick a file to send to Tuleap",
                items: quickPickItems,
                activeItem: state.selectedFile,
                shouldResume: shouldResume,
            });
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

        function uploadFileToTuleap(): Promise<void> {
            // TODO call api
            console.log("should call a rest upload file");
            return Promise.resolve();
        }
    });
};
