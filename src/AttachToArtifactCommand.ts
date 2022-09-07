import type { Disposable } from "vscode";
import { Uri, workspace, window, env, QuickInputButtons } from "vscode";
import * as fs from "fs/promises";
import * as mime from "mime/lite";
import * as path from "path";
import { APIQuerier } from "./APIQuerier";
import { EmptyDisposable } from "./EmptyDisposable";
import { FileDescriptorDisposable } from "./FileDescriptorDisposable";
import type { InputStep } from "./MultiStepInput";
import { MultiStepInput } from "./MultiStepInput";

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

type ArtifactIdEntered = {
    readonly artifact_id: number;
};

type FieldIdEntered = {
    readonly artifact_id: number;
    readonly field_id: number;
};

//TODO: store access key as a secret
//TODO: store Tuleap URI as an extension settings
export const AttachToArtifactCommand = () => (): void => {
    MultiStepInput.run((input) => inputArtifactIdStep(input));
};

function validateIsANumber(input: string): Promise<string | undefined> {
    const input_as_number = Number.parseInt(input, 10);
    if (Number.isNaN(input_as_number)) {
        return Promise.resolve("Artifact id must be a number");
    }
    if (Number(input) !== input_as_number) {
        return Promise.resolve("Artifact id must be a number");
    }
    return Promise.resolve(undefined);
}

function shouldResume(): Promise<boolean> {
    // Could show a notification with the option to resume.
    return Promise.resolve(false);
}

const title = "Attach a file to an Artifact";

async function inputArtifactIdStep(input: MultiStepInput): Promise<InputStep> {
    const artifact_id = await input.showInputBox({
        title,
        step: 1,
        totalSteps: 3, //Note: there are not really 3 steps, because the third step is to choose a file
        value: "",
        prompt: "Enter an Artifact ID",
        validate: validateIsANumber,
        shouldResume,
    });
    if (artifact_id === QuickInputButtons.Back) {
        return () => Promise.resolve(undefined);
    }
    const state: ArtifactIdEntered = {
        artifact_id: Number(artifact_id),
    };
    return (input) => inputFieldIdStep(input, state);
}

async function inputFieldIdStep(
    input: MultiStepInput,
    state: ArtifactIdEntered
): Promise<InputStep> {
    const field_id = await input.showInputBox({
        title,
        step: 2,
        totalSteps: 3,
        value: "",
        prompt: "Enter the ID of the file attachments field",
        validate: validateIsANumber,
        shouldResume,
    });
    if (field_id === QuickInputButtons.Back) {
        return (input) => inputArtifactIdStep(input);
    }
    const new_state: FieldIdEntered = {
        artifact_id: state.artifact_id,
        field_id: Number(field_id),
    };
    // Note: the UX can certainly be improved, it is a little bit weird that a "select a file" dialog opens out of a sudden.
    // We should probably use a button for that.
    return () => selectAFileAndAttachItStep(new_state);
}

function getBaseFolderToOpenDialog(): Uri {
    if (workspace.workspaceFolders !== undefined) {
        return workspace.workspaceFolders[0].uri;
    }
    return Uri.file(".");
}

function selectAFileAndAttachItStep(state: FieldIdEntered): Thenable<void> {
    //TODO: ask the user for those
    const personal_access_key = "<replace me by a Tuleap personal access key>";
    const tuleap_authority = `tuleap-web.tuleap-aio-dev.docker`;

    const querier = APIQuerier(tuleap_authority, personal_access_key);

    let open_file_descriptor: Disposable = EmptyDisposable();

    return window
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
            return querier.createFile(state.field_id, file);
        })
        .then((file: NewFileCreated) => {
            console.log("Starting TUS Upload");
            return querier.uploadFile(file);
        })
        .then((file: FileUploaded) => {
            open_file_descriptor.dispose();
            console.log("Attaching file to Artifact");
            return querier.attachFileToArtifact(state.artifact_id, state.field_id, file.file_id);
        })
        .then(() => {
            const artifact_uri = Uri.from({
                scheme: "https",
                authority: tuleap_authority,
                path: `/plugins/tracker/`,
                query: `aid=${state.artifact_id}`,
            });

            return window
                .showInformationMessage(
                    "Successfully attached the file to the Artifact",
                    "Go to Artifact"
                )
                .then((button) => {
                    if (button === undefined) {
                        return Promise.resolve(true);
                    }
                    return env.openExternal(artifact_uri);
                });
        })
        .then(
            () => {
                // Nothing more to do
            },
            (reason) => {
                window.showErrorMessage("Error in Attach To Artifact command: " + reason);
                open_file_descriptor.dispose();
            }
        );
}
