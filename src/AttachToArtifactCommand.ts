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
import { EXTENSION_NAME } from "./extension";

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

type TuleapBaseURIEntered = {
    readonly tuleap_base_uri: string;
    readonly previous_step: number;
    readonly total_steps: number;
};

type TuleapAccessKeyEntered = TuleapBaseURIEntered & {
    readonly personal_access_key: string;
};

type ArtifactIdEntered = TuleapAccessKeyEntered & {
    readonly artifact_id: number;
};

type FieldIdEntered = ArtifactIdEntered & {
    readonly field_id: number;
};

const BASE_URL_SETTING_KEY = "tuleap_base_url";

export const AttachToArtifactCommand = () => (): void => {
    MultiStepInput.run((input) => inputTuleapBaseURI(input));
};

const validatorThatAcceptsAnything = (): Promise<undefined> => Promise.resolve(undefined);

function validateIsAnURL(input: string): Promise<string | undefined> {
    try {
        new URL(input);
    } catch {
        return Promise.resolve("Invalid URL");
    }

    return Promise.resolve(undefined);
}

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

const noopStep: InputStep = () => Promise.resolve(undefined);

const title = "Attach a file to an Artifact";

async function inputTuleapBaseURI(input: MultiStepInput): Promise<InputStep> {
    const settings = workspace.getConfiguration(EXTENSION_NAME);
    const base_uri_from_settings = settings.get(BASE_URL_SETTING_KEY);
    if (base_uri_from_settings !== null && base_uri_from_settings !== "") {
        const state: TuleapBaseURIEntered = {
            tuleap_base_uri: String(base_uri_from_settings),
            previous_step: 0,
            total_steps: 4,
        };
        return (input) => inputAccessKey(input, state);
    }

    const current_step = 1;
    const total_steps = 5; //Note: there are not really as many steps, because the last step is to choose a file
    const entered_base_uri = await input.showInputBox({
        title,
        step: current_step,
        totalSteps: total_steps,
        value: "https://tuleap.net",
        prompt: "Enter an URL to a Tuleap instance",
        validate: validateIsAnURL,
        shouldResume,
    });
    if (entered_base_uri === QuickInputButtons.Back) {
        return noopStep;
    }

    settings.update(BASE_URL_SETTING_KEY, String(entered_base_uri));

    const state: TuleapBaseURIEntered = {
        tuleap_base_uri: String(entered_base_uri),
        previous_step: current_step,
        total_steps: total_steps,
    };
    return (input) => inputAccessKey(input, state);
}

async function inputAccessKey(
    input: MultiStepInput,
    state: TuleapBaseURIEntered
): Promise<InputStep> {
    //TODO: store access key as a secret
    const current_step = state.previous_step + 1;
    const entered_access_key = await input.showInputBox({
        title,
        step: current_step,
        totalSteps: state.total_steps,
        value: "",
        prompt: "Enter a personal access key with REST API scope",
        validate: validatorThatAcceptsAnything,
        shouldResume,
    });
    if (entered_access_key === QuickInputButtons.Back) {
        return (input) => inputTuleapBaseURI(input);
    }

    const new_state: TuleapAccessKeyEntered = {
        ...state,
        personal_access_key: String(entered_access_key),
        previous_step: current_step,
    };
    return (input) => inputArtifactIdStep(input, new_state);
}

async function inputArtifactIdStep(
    input: MultiStepInput,
    state: TuleapAccessKeyEntered
): Promise<InputStep> {
    const current_step = state.previous_step + 1;
    const artifact_id = await input.showInputBox({
        title,
        step: current_step,
        totalSteps: state.total_steps,
        value: "",
        prompt: "Enter an Artifact ID",
        validate: validateIsANumber,
        shouldResume,
    });
    if (artifact_id === QuickInputButtons.Back) {
        return (input) => inputAccessKey(input, state);
    }
    const new_state: ArtifactIdEntered = {
        ...state,
        artifact_id: Number(artifact_id),
        previous_step: current_step,
    };
    return (input) => inputFieldIdStep(input, new_state);
}

async function inputFieldIdStep(
    input: MultiStepInput,
    state: ArtifactIdEntered
): Promise<InputStep> {
    const current_step = state.previous_step + 1;
    const field_id = await input.showInputBox({
        title,
        step: current_step,
        totalSteps: state.total_steps,
        value: "",
        prompt: "Enter the ID of the file attachments field",
        validate: validateIsANumber,
        shouldResume,
    });
    if (field_id === QuickInputButtons.Back) {
        return (input) => inputArtifactIdStep(input, state);
    }
    const new_state: FieldIdEntered = {
        ...state,
        field_id: Number(field_id),
        previous_step: current_step,
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
    const querier = APIQuerier(state.tuleap_base_uri, state.personal_access_key);

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
            const url = new URL(
                `/plugins/tracker/?aid=${state.artifact_id}`,
                state.tuleap_base_uri
            );
            const artifact_uri = Uri.parse(url.href, true);

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
