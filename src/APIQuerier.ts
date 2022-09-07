// Note: instead of using axios (which weighs ~250KiB, that is simply too much)
// we should build our own abstraction on top of node's https module.
import axios from "axios";
import { Upload } from "tus-js-client";
import type { FileStatsRetrieved, FileUploaded, NewFileCreated } from "./AttachToArtifactCommand";

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

const mapToRequest = (file: FileStatsRetrieved): PostFileRequest => ({
    name: file.file_name,
    file_size: file.file_size,
    file_type: file.file_type,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unwrapRestlerError = (error: any): never => {
    if ("response" in error) {
        if ("data" in error.response) {
            if ("error" in error.response.data) {
                const restler_error = error.response.data.error;
                throw new Error(`API Error: ${restler_error.code} ${restler_error.message}`);
            }
        }
    }
    throw error;
};

const CHUNK_SIZE = 67108864; // = 64 MiB. Number of bytes held in memory at a time during file upload;

export type APIQuerier = {
    createFile(field_id: number, file: FileStatsRetrieved): Promise<NewFileCreated>;

    uploadFile(file: NewFileCreated): Promise<FileUploaded>;

    attachFileToArtifact(artifact_id: number, field_id: number, file_id: number): Promise<void>;
};

export const APIQuerier = (tuleap_base_uri: string, personal_access_key: string): APIQuerier => ({
    createFile: (field_id, file): Promise<NewFileCreated> => {
        const url = new URL(`/api/v1/tracker_fields/${field_id}/files`, tuleap_base_uri);
        const request = mapToRequest(file);

        return axios
            .post<PostFileResponse>(url.href, request, {
                headers: {
                    "X-Auth-AccessKey": personal_access_key,
                    "Content-type": "application/json",
                },
            })
            .then(
                (response) => ({
                    handle: file.handle,
                    file_id: response.data.id,
                    file_name: file.file_name,
                    file_size: file.file_size,
                    file_type: file.file_type,
                    upload_href: response.data.upload_href,
                }),
                unwrapRestlerError
            );
    },

    uploadFile: (file): Promise<FileUploaded> => {
        const upload_url = new URL(file.upload_href, tuleap_base_uri);

        return new Promise<FileUploaded>((resolve, reject) => {
            const uploader = new Upload(file.handle.createReadStream({ start: 0 }), {
                uploadUrl: upload_url.href,
                headers: { "X-Auth-AccessKey": personal_access_key },
                // Note that tus-js-client's documentation specifies to avoid setting chunkSize and uploadSize unless forced to.
                // We are forced to set them, it does not look like the detection of ReadableStream worked in our case.
                chunkSize: CHUNK_SIZE,
                uploadSize: file.file_size,
                onError: (error): void => {
                    reject(error);
                },
                onSuccess: (): void => {
                    resolve({ file_id: file.file_id });
                },
            });
            uploader.start();
        });
    },

    attachFileToArtifact: (artifact_id, field_id, file_id): Promise<void> => {
        const url = new URL(`/api/v1/artifacts/${artifact_id}`, tuleap_base_uri);

        return axios
            .put(
                url.href,
                { values: [{ field_id, value: [file_id] }] },
                {
                    headers: {
                        "X-Auth-AccessKey": personal_access_key,
                        "Content-type": "application/json",
                    },
                }
            )
            .then(() => {
                // Ignore the response
            }, unwrapRestlerError);
    },
});
