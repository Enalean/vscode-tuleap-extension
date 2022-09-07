import { Disposable } from "vscode";
import type { FileHandle } from "fs/promises";

type FileDescriptorDisposable = {
    fromFileHandle(handle: FileHandle): Disposable;
};

export const FileDescriptorDisposable: FileDescriptorDisposable = {
    fromFileHandle: (handle): Disposable => new Disposable(() => handle.close()),
};
