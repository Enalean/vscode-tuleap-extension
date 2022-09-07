// import type { QuickPickItem } from "vscode";
import type { Disposable } from "vscode";
import { Uri, workspace, window } from "vscode";
import * as fs from "fs/promises";
import * as mime from "mime/lite";
import * as path from "path";
import { APIQuerier } from "./APIQuerier";
import { EmptyDisposable } from "./EmptyDisposable";
import { FileDescriptorDisposable } from "./FileDescriptorDisposable";
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

type FileOpened = {
    readonly handle: fs.FileHandle;
    readonly path: string;
};

export type FileStatsRetrieved = {
    readonly handle: fs.FileHandle;
    readonly file_name: string;
    readonly file_size: number;
    readonly file_type: string;
};

export type NewFileCreated = {
    readonly handle: fs.FileHandle;
    readonly file_id: number;
    readonly file_name: string;
    readonly file_size: number;
    readonly file_type: string;
    readonly upload_href: string;
};

export type FileUploaded = {
    readonly file_id: number;
};

function getBaseFolderToOpenDialog(): Uri {
    if (workspace.workspaceFolders !== undefined) {
        return workspace.workspaceFolders[0].uri;
    }
    return Uri.file(".");
}

export const AttachToArtifactCommand = () => (): void => {
    //TODO: ask user for Tuleap URL, field_id, artifact_id and access_key
    // project_id = 107
    // tracker_id = 68
    const field_id = 1394;
    const artifact_id = 6616;
    const personal_access_key = "<replace me by a Tuleap personal access key>";
    const tuleap_base_uri = `https://tuleap-web.tuleap-aio-dev.docker`;

    const querier = APIQuerier(tuleap_base_uri, personal_access_key);

    let open_file_descriptor: Disposable = EmptyDisposable();

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
            fs.open(uri.fsPath).then((handle): FileOpened => {
                open_file_descriptor = FileDescriptorDisposable.fromFileHandle(handle);
                return { path: uri.fsPath, handle };
            })
        )
        .then((file: FileOpened) => {
            const file_type = mime.getType(file.path) ?? "";
            const file_name = path.basename(file.path);

            return file.handle.stat().then(
                (stats): FileStatsRetrieved => ({
                    handle: file.handle,
                    file_name,
                    file_type,
                    file_size: stats.size,
                })
            );
        })
        .then((file: FileStatsRetrieved) => {
            console.log("Creating upload on Tuleap");
            return querier.createFile(field_id, file);
        })
        .then((file: NewFileCreated) => {
            console.log("Starting TUS Upload");
            return querier.uploadFile(file);
        })
        .then((file: FileUploaded) => {
            console.log("Attaching file to Artifact");
            return querier.attachFileToArtifact(artifact_id, field_id, file.file_id);
        })
        .then(
            () => {
                window.showInformationMessage(
                    "Successfully attached the file to the Tuleap Artifact"
                );
                open_file_descriptor.dispose();
            },
            (reason) => {
                window.showErrorMessage("Error in Attach To Artifact command: " + reason);
                open_file_descriptor.dispose();
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
