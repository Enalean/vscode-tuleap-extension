// Note: instead of using axios (which weighs ~250KiB, that is simply too much)
// we should build our own abstraction on top of node's https module.
import axios from "axios";
import type { FileStatsRetrieved, NewFileCreated } from "./HelloWorldCommand";

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

export type APIQuerier = {
    createFile(field_id: number, file: FileStatsRetrieved): Promise<NewFileCreated>;

    attachFileToArtifact(artifact_id: number, field_id: number, file_id: number): Promise<void>;
};

export const APIQuerier = (tuleap_base_uri: string, personal_access_key: string): APIQuerier => ({
    createFile: (field_id, file): Promise<NewFileCreated> => {
        const request = mapToRequest(file);
        return axios
            .post<PostFileResponse>(
                `${tuleap_base_uri}/api/v1/tracker_fields/${field_id}/files`,
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

    attachFileToArtifact: (artifact_id, field_id, file_id): Promise<void> =>
        axios.put(
            `${tuleap_base_uri}/api/v1/artifacts/${artifact_id}`,
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
