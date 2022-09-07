# README

Alpha (unstable) extension for [Tuleap][0]. This is a proof-of-concept for what a future Visual Studio Code extension for Tuleap could do.

## Features

This extension lets you attach a file to a [Tuleap][0] Artifact with the "Attach to Artifact" command. This command can be called either by right-clicking a file in the File Explorer, or directly from the Command menu.

It has 5 steps:
1. Unless previously configured in workspace settings, it will ask the base URL of a Tuleap instance. For example: `https://tuleap.net`.
2. Unless previously entered, it will ask for a personal access key of a Tuleap User. The key **must** have the `REST` scope. It will be used in all REST API calls to Tuleap.
3. It will ask for an Artifact ID on which it should attach the file. Please make sure the Tuleap User whose personal access key is used has the permission to read and update that artifact.
4. It will ask for a Field ID for the File Attachments field. Please make sure the Tuleap User has the permission to update that field in the Tracker.
5. Unless previously selected by a right-click, it will ask to select a file.

Once all those steps are completed, the selected file will be uploaded to the Tuleap server and attached to the Artifact. A notification should open with a button to access the Artifact.

**Note**: for steps 1 and 2, the extension will reuse the last entered value by default. If you wish to modify them, click on the "Back" button in the quick input.

## Extension Settings

This extension contributes the following settings:

* `tuleap.tuleap_base_url`: Stores the base URL to the Tuleap instance you will be using.

## Known Issues

* The "Attach to Artifact" command will overwrite all previously attached files on the artifact.
* It's not possible to attach more than one file at a time using the command.
* The command asks for a Field ID for the File Attachments field, but using the REST API it could find it by itself, without the need to ask.

## Release Notes

### 0.1.0

Alpha release of `tuleap`. Added the "Attach to Artifact" command.

## Links

- [https://tuleap.org][0]

[0]: https://tuleap.org
