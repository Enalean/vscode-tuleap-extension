// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import { QuickPickItem, window, Disposable, CancellationToken, QuickInputButton, QuickInput, ExtensionContext, QuickInputButtons, Uri } from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	const resourceGroups: QuickPickItem[] = [];

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('tuleap-file-upload.helloWorld', () => {
		// TODO make this relative
		const inputAsWorkspaceRelativeFolder = './custom_folder';

		fs.readdir(inputAsWorkspaceRelativeFolder, (err, files: string[]) => {
			files.forEach((file) => {
				const uri = vscode.Uri.file(file);
				resourceGroups.push({ label: uri.path });
			});

			class MyButton implements QuickInputButton {
				constructor(public iconPath: { light: Uri; dark: Uri; }, public tooltip: string) { }
			}

			const createResourceGroupButton = new MyButton({
				dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
				light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
			}, 'Create Resource Group');

			interface State {
				title: string;
				step: number;
				totalSteps: number;
				resourceGroup: QuickPickItem | string;
				name: string;
				runtime: QuickPickItem;
			}

			async function collectInputs() {
				const state = {} as Partial<State>;
				await MultiStepInput.run(input => pickResourceGroup(input, state));
				return state as State;
			}

			const title = 'Send file to Tuleap';

			async function pickResourceGroup(input: MultiStepInput, state: Partial<State>) {
				const pick = await input.showQuickPick({
					title,
					step: 1,
					totalSteps: 3,
					placeholder: 'Pick a file to send to Tuleap',
					items: resourceGroups,
					activeItem: typeof state.resourceGroup !== 'string' ? state.resourceGroup : undefined,
					buttons: [createResourceGroupButton],
					shouldResume: shouldResume
				});
				if (pick instanceof MyButton) {
					return (input: MultiStepInput) => inputChooseArtifact(input, state);
				}
				state.resourceGroup = pick;
				return (input: MultiStepInput) => inputChooseArtifact(input, state);
			}

			async function inputChooseArtifact(input: MultiStepInput, state: Partial<State>) {
				state.resourceGroup = await input.showInputBox({
					title,
					step: 2,
					totalSteps: 4,
					value: typeof state.resourceGroup === 'string' ? state.resourceGroup : '',
					prompt: 'Enter your artifact id',
					validate: validateIsANumber,
					shouldResume: shouldResume
				});
				return (input: MultiStepInput) => uploadFileToTuleap(input, state);
			}

			async function uploadFileToTuleap(input: MultiStepInput, state: Partial<State>) {
				// TODO call api
				console.log("should call a rest upload file");
			}

			function shouldResume() {
				// Could show a notification with the option to resume.
				return new Promise<boolean>((resolve, reject) => {
					// noop
				});
			}

			async function validateIsANumber(name: string) {
				// TODO check is KO validation is not done
				// ...validate...
				await new Promise(resolve => setTimeout(resolve, 1000));
				console.log(name);
				return name === '0123456789' ? 'Artifact id must be a number' : undefined;
			}
		});
	});

}

// this method is called when your extension is deactivated
export function deactivate() {}


// -------------------------------------------------------
// Helper code that wraps the API for the multi-step case.
// -------------------------------------------------------


class InputFlowAction {
	static back = new InputFlowAction();
	static cancel = new InputFlowAction();
	static resume = new InputFlowAction();
}

type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;

interface QuickPickParameters<T extends QuickPickItem> {
	title: string;
	step: number;
	totalSteps: number;
	items: T[];
	activeItem?: T;
	placeholder: string;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}

interface InputBoxParameters {
	title: string;
	step: number;
	totalSteps: number;
	value: string;
	prompt: string;
	validate: (value: string) => Promise<string | undefined>;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}

class MultiStepInput {

	static async run<T>(start: InputStep) {
		const input = new MultiStepInput();
		return input.stepThrough(start);
	}

	private current?: QuickInput;
	private steps: InputStep[] = [];

	private async stepThrough<T>(start: InputStep) {
		let step: InputStep | void = start;
		while (step) {
			this.steps.push(step);
			if (this.current) {
				this.current.enabled = false;
				this.current.busy = true;
			}
			try {
				step = await step(this);
			} catch (err) {
				if (err === InputFlowAction.back) {
					this.steps.pop();
					step = this.steps.pop();
				} else if (err === InputFlowAction.resume) {
					step = this.steps.pop();
				} else if (err === InputFlowAction.cancel) {
					step = undefined;
				} else {
					throw err;
				}
			}
		}
		if (this.current) {
			this.current.dispose();
		}
	}

	async showQuickPick<T extends QuickPickItem, P extends QuickPickParameters<T>>({ title, step, totalSteps, items, activeItem, placeholder, buttons, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<T | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createQuickPick<T>();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.placeholder = placeholder;
				input.items = items;
				if (activeItem) {
					input.activeItems = [activeItem];
				}
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidChangeSelection(items => resolve(items[0])),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}

	async showInputBox<P extends InputBoxParameters>({ title, step, totalSteps, value, prompt, validate, buttons, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<string | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createInputBox();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.value = value || '';
				input.prompt = prompt;
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				let validating = validate('');
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidAccept(async () => {
						const value = input.value;
						input.enabled = false;
						input.busy = true;
						if (!(await validate(value))) {
							resolve(value);
						}
						input.enabled = true;
						input.busy = false;
					}),
					input.onDidChangeValue(async text => {
						const current = validate(text);
						validating = current;
						const validationMessage = await current;
						if (current === validating) {
							input.validationMessage = validationMessage;
						}
					}),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}
}
