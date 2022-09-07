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

const CHUNK_SIZE = 67108864; // = 64 MiB. Number of bytes held in memory at a time during file upload;

export type APIQuerier = {
    createFile(field_id: number, file: FileStatsRetrieved): Promise<NewFileCreated>;

    uploadFile(file: NewFileCreated): Promise<FileUploaded>;

    attachFileToArtifact(artifact_id: number, field_id: number, file_id: number): Promise<void>;
};

export const APIQuerier = (tuleap_authority: string, personal_access_key: string): APIQuerier => ({
    createFile: (field_id, file): Promise<NewFileCreated> => {
        const request = mapToRequest(file);
        return axios
            .post<PostFileResponse>(
                `https://${tuleap_authority}/api/v1/tracker_fields/${field_id}/files`,
                request,
                {
                    headers: {
                        "X-Auth-AccessKey": personal_access_key,
                        "Content-type": "application/json",
                    },
                }
            )
            .then((response) => ({
                handle: file.handle,
                file_id: response.data.id,
                file_name: file.file_name,
                file_size: file.file_size,
                file_type: file.file_type,
                upload_href: response.data.upload_href,
            }));
    },

    uploadFile: (file): Promise<FileUploaded> => {
        const uploadUrl = new URL(file.upload_href, `https://${tuleap_authority}`);

        return new Promise<FileUploaded>((resolve, reject) => {
            //TODO: feature request being able to pass number values as metadata. String type is rejected by Tuleap's Restler validation (for `file_size`)
            const uploader = new Upload(file.handle.createReadStream({ start: 0 }), {
                uploadUrl: uploadUrl.href,
                headers: { "X-Auth-AccessKey": personal_access_key },
                // Note that tus-js-client's documentation specifies to avoid setting chunkSize and uploadSize unless forced to.
                // We are forced to set them, it does not look like the detection of ReadableStream worked in our case.
                //TODO: minimize the reproduction and report the issue
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

    attachFileToArtifact: (artifact_id, field_id, file_id): Promise<void> =>
        axios.put(
            `https://${tuleap_authority}/api/v1/artifacts/${artifact_id}`,
            {
                values: [
                    {
                        field_id,
                        value: [file_id],
                    },
                ],
            },
            {
                headers: {
                    "X-Auth-AccessKey": personal_access_key,
                },
            }
        ),
});
