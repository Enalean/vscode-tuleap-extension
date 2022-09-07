// import type { QuickPickItem } from "vscode";
import { Uri, workspace, window } from "vscode";
// Note: instead of using axios (which weighs ~250KiB, that is simply too much)
// we should build our own abstraction on top of node's https module.
import axios from "axios";
import * as fs from "fs/promises";
import * as mime from "mime/lite";
import * as path from "path";
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

type IncompleteFileData = {
    readonly path: string;
    readonly file_size: number;
};

//TODO: move in some kind of querier
type PostFileRequest = {
    readonly name: string;
    readonly file_size: number;
    readonly file_type: string;
};

type PostFileResponse = {
    readonly id: number;
    readonly download_href: string;
    readonly upload_href: string;
};

function getBaseFolderToOpenDialog(): Uri {
    if (workspace.workspaceFolders !== undefined) {
        return workspace.workspaceFolders[0].uri;
    }
    return Uri.file(".");
}

function buildFileRequest(file: IncompleteFileData): PostFileRequest {
    const file_type = mime.getType(file.path) ?? "";
    const file_name = path.basename(file.path);

    return {
        name: file_name,
        file_size: file.file_size,
        file_type,
    };
}

//TODO: abort ctrler
function createFile(
    field_id: number,
    personal_access_key: string,
    representation: PostFileRequest
): Promise<PostFileResponse> {
    return axios
        .post<PostFileResponse>(
            `https://tuleap-web.tuleap-aio-dev.docker/api/v1/tracker_fields/${field_id}/files`,
            representation,
            {
                headers: {
                    "X-Auth-AccessKey": personal_access_key,
                    "Content-type": "application/json",
                },
            }
        )
        .then((response) => response.data);
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
        .then((selected_files: Uri[] | undefined) => {
            if (!selected_files) {
                return Promise.reject("No file selected");
            }
            return selected_files[0];
        })
        .then((uri: Uri) =>
            fs.stat(uri.fsPath).then((stats) => ({ path: uri.fsPath, file_size: stats.size }))
        )
        .then((file: IncompleteFileData) => {
            const representation = buildFileRequest(file);

            // project_id = 107
            // tracker_id = 68
            const field_id = 1394;
            // artifact_id = 6616
            const personal_access_key = "<replace me by a Tuleap personal access key>";

            console.log("Making HTTP request to Tuleap");
            return createFile(field_id, personal_access_key, representation);
        })
        .then(
            (response: PostFileResponse) => {
                console.log(response);
            },
            (reason) => {
                console.error("Error in Hello World command: " + reason);
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
