// import type { QuickPickItem } from "vscode";
import { Uri, workspace, window } from "vscode";
import axios from "axios";
// import * as fs from "fs";
// import type { InputStep } from "./MultiStepInput";
// import { MultiStepInput } from "./MultiStepInput";

// interface State {
//     title: string;
//     step: number;
//     totalSteps: number;
//     selectedFile: QuickPickItem;
//     name: string;
//     runtime: QuickPickItem;
// }

// function shouldResume(): Promise<boolean> {
//     // Could show a notification with the option to resume.
//     return new Promise<boolean>(() => {
//         // noop
//     });
// }

// async function validateIsANumber(name: string): Promise<string | undefined> {
//     // TODO check is KO validation is not done
//     // ...validate...
//     await new Promise((resolve) => setTimeout(resolve, 1000));
//     console.log(name);
//     return name === "0123456789" ? "Artifact id must be a number" : undefined;
// }

// Disable NodeJS checking TLS certificates altogether.
// DO NOT USE IN PRODUCTION
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function getBaseFolderToOpenDialog(): Uri {
    if (workspace.workspaceFolders !== undefined) {
        return workspace.workspaceFolders[0].uri;
    }
    return Uri.file(".");
}

function createFile(field_id: number, personal_access_key: string): void {
    axios
        .post(`https://tuleap-web.tuleap-aio-dev.docker/api/v1/tracker_fields/${field_id}/files`, {
            headers: { "X-Auth-AccessKey": personal_access_key },
        })
        .then(
            (response) => {
                console.log(response.status);
            },
            (reason) => {
                console.error("Could not make an HTTP request: %s", reason);
            }
        );
}

export const HelloWorldCommand = (): void => {
    window
        .showOpenDialog({
            canSelectMany: false,
            canSelectFolders: false,
            title: "Select a file to send to Tuleap",
            openLabel: "Select",
            defaultUri: getBaseFolderToOpenDialog(),
        })
        .then(
            (selected_files) => {
                if (!selected_files) {
                    console.error("No file selected !");
                }
                console.log(selected_files);

                // project_id = 107
                // tracker_id = 68
                const field_id = 1394;
                // artifact_id = 6616
                const personal_access_key = "<replace me by a Tuleap personal access key>";

                console.log("Making HTTP request to Tuleap");

                createFile(field_id, personal_access_key);
            },
            (reason) => {
                console.error("Could not show the open file dialog: %s", reason);
            }
        );
    // const quickPickItems: QuickPickItem[] = [];
    // fs.readdir(".", (err, files: string[]) => {
    //     files.forEach((file) => {
    //         const uri = Uri.file(file);
    //         quickPickItems.push({ label: uri.path });
    //     });

    //     const title = "Send file to Tuleap";

    //     async function runMultiStep(): Promise<void> {
    //         const state: Partial<State> = {};
    //         await MultiStepInput.run((input) => pickAFile(input, state));
    //     }

    //     runMultiStep();

    //     async function pickAFile(input: MultiStepInput, state: Partial<State>): Promise<InputStep> {
    //         await input.showQuickPick({
    //             title,
    //             step: 1,
    //             totalSteps: 3,
    //             placeholder: "Pick a file to send to Tuleap",
    //             items: quickPickItems,
    //             activeItem: state.selectedFile,
    //             shouldResume: shouldResume,
    //         });
    //         return (input: MultiStepInput) => inputChooseArtifact(input);
    //     }

    //     async function inputChooseArtifact(input: MultiStepInput): Promise<InputStep> {
    //         await input.showInputBox({
    //             title,
    //             step: 2,
    //             totalSteps: 4,
    //             value: "",
    //             prompt: "Enter your artifact id",
    //             validate: validateIsANumber,
    //             shouldResume: shouldResume,
    //         });
    //         return () => uploadFileToTuleap();
    //     }

    //     function uploadFileToTuleap(): Promise<void> {
    //         // TODO call api
    //         console.log("should call a rest upload file");
    //         return Promise.resolve();
    //     }
    // });
};
