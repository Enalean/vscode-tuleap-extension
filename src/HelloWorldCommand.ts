import type { QuickPickItem, QuickInputButton } from "vscode";

import { ThemeIcon, Uri } from "vscode";
import * as fs from "fs";
import type { InputStep } from "./MultiStepInput";
import { MultiStepInput } from "./MultiStepInput";

interface State {
    title: string;
    step: number;
    totalSteps: number;
    resourceGroup: QuickPickItem | undefined;
    name: string;
    runtime: QuickPickItem;
}

class MyButton implements QuickInputButton {
    constructor(public iconPath: ThemeIcon, public tooltip: string) {}
}

export const HelloWorldCommand = (): void => {
    const resourceGroups: QuickPickItem[] = [];

    fs.readdir(".", (err, files: string[]) => {
        files.forEach((file) => {
            const uri = Uri.file(file);
            resourceGroups.push({ label: uri.path });
        });

        const createResourceGroupButton = new MyButton(
            new ThemeIcon("add"),
            "Create Resource Group"
        );

        const title = "Send file to Tuleap";

        async function collectInputs(): Promise<void> {
            const state: Partial<State> = {};
            await MultiStepInput.run((input) => pickResourceGroup(input, state));
        }

        collectInputs();

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
};
