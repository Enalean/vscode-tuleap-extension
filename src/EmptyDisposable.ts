import { Disposable } from "vscode";

export const EmptyDisposable = (): Disposable =>
    new Disposable(() => {
        // Do nothing
    });
