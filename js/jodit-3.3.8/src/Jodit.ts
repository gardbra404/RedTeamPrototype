/*!
 * Jodit Editor (https://xdsoft.net/jodit/)
 * Licensed under GNU General Public License version 2 or later or a commercial license or MIT;
 * For GPL see LICENSE-GPL.txt in the project root for license information.
 * For MIT see LICENSE-MIT.txt in the project root for license information.
 * For commercial licenses see https://xdsoft.net/jodit/commercial/
 * Copyright (c) 2013-2019 Valeriy Chupurnov. All rights reserved. https://xdsoft.net
 */

import { Config, OptionsDefault } from './Config';
import * as consts from './constants';
import { Component } from './modules/Component';
import { Dom } from './modules/Dom';
import {
	asArray,
	css,
	debounce,
	inArray,
	normalizeKeyAliases,
	splitArray
} from './modules/helpers/';

import { JoditArray } from './modules/helpers/JoditArray';
import { JoditObject } from './modules/helpers/JoditObject';
import { Observer } from './modules/observer/observer';
import { Select } from './modules/Selection';
import { StatusBar } from './modules/StatusBar';
import { Storage } from './modules/storage/storage';

import {
	CustomCommand,
	ExecCommandCallback,
	IDictionary,
	IPluginSystem,
	markerInfo,
	Modes
} from './types';

import { ViewWithToolbar } from './modules/view/viewWithToolbar';
import { IJodit, IFileBrowser, IUploader } from './types/';
import { PluginSystem } from './modules/PluginSystem';

const SAFE_COUNT_CHANGE_CALL = 10;

/**
 * Class Jodit. Main class
 */
export class Jodit extends ViewWithToolbar implements IJodit {
	/**
	 * Define if object is Jodit
	 */
	get isJodit(): true {
		return true;
	}

	get value(): string {
		return this.getEditorValue();
	}

	set value(html: string) {
		this.setEditorValue(html);
	}

	/**
	 * Return default timeout period in milliseconds for some debounce or throttle functions.
	 * By default return {observer.timeout} options
	 *
	 * @return {number}
	 */
	get defaultTimeout(): number {
		return this.options && this.options.observer
			? this.options.observer.timeout
			: Jodit.defaultOptions.observer.timeout;
	}

	/**
	 * Method wrap usual Array in Object helper for prevent deep array merging in options
	 *
	 * @param array
	 * @constructor
	 */
	static Array(array: any[]): JoditArray {
		return new JoditArray(array);
	}

	/**
	 * Method wrap usual Has Object in Object helper for prevent deep object merging in options*
	 *
	 * @param object
	 * @constructor
	 */
	static Object(object: any): JoditObject {
		return new JoditObject(object);
	}

	/**
	 * Emits events in all instances
	 *
	 * @param events
	 * @param args
	 */
	static fireEach(events: string, ...args: any[]) {
		Object.keys(Jodit.instances).forEach(key => {
			const editor: Jodit = Jodit.instances[key];

			if (!editor.isDestructed && editor.events) {
				editor.events.fire(events, ...args);
			}
		});
	}

	/**
	 * Fabric for creating Jodit instance
	 *
	 * @param element
	 * @param options
	 */
	static make(element: HTMLInputElement | string, options?: object): Jodit {
		return new Jodit(element, options);
	}

	static defaultOptions: Config;
	static plugins: IPluginSystem = new PluginSystem();
	static modules: any = {};
	static instances: IDictionary<Jodit> = {};
	static lang: any = {};

	private __defaultStyleDisplayKey = 'data-jodit-default-style-display';
	private __defaultClassesKey = 'data-jodit-default-classes';

	private commands: IDictionary<Array<CustomCommand<IJodit>>> = {};

	private __selectionLocked: markerInfo[] | null = null;

	private __wasReadOnly: boolean = false;

	/**
	 * @property {HTMLDocument} editorDocument
	 */
	editorDocument: HTMLDocument;

	/**
	 * @property {Window} editorWindow
	 */
	editorWindow: Window;

	/**
	 * Container for set/get value
	 * @type {Storage}
	 */
	storage = Storage.makeStorage(true, this.id);

	/**
	 * Editor has focus in this time
	 */
	editorIsActive: boolean = false;

	/**
	 * workplace It contains source and wysiwyg editors
	 */
	workplace: HTMLDivElement;

	statusbar: StatusBar;
	observer: Observer;

	/**
	 * element It contains source element
	 */
	element: HTMLElement;

	/**
	 * editor It contains the root element editor
	 */
	editor: HTMLDivElement | HTMLBodyElement;

	/**
	 * iframe Iframe for iframe mode
	 */
	iframe: HTMLIFrameElement | null = null;

	/**
	 * options All Jodit settings default + second arguments of constructor
	 */
	options: Config;

	/**
	 * @property {Select} selection
	 */
	selection: Select;

	/**
	 * @property {Uploader} uploader
	 */
	get uploader(): IUploader {
		return this.getInstance('Uploader');
	}

	/**
	 * @property {FileBrowser} filebrowser
	 */
	get filebrowser(): IFileBrowser {
		return this.getInstance('FileBrowser');
	}

	helper: any;

	mode: Modes = consts.MODE_WYSIWYG;

	/**
	 * Return source element value
	 */
	getElementValue() {
		return (this.element as HTMLInputElement).value !== undefined
			? (this.element as HTMLInputElement).value
			: this.element.innerHTML;
	}

	/**
	 * Return real HTML value from WYSIWYG editor.
	 *
	 * @return {string}
	 */
	getNativeEditorValue(): string {
		if (this.editor) {
			return this.editor.innerHTML;
		}

		return this.getElementValue();
	}

	/**
	 * Set value to native editor
	 * @param value
	 */
	setNativeEditorValue(value: string) {
		if (this.editor) {
			this.editor.innerHTML = value;
		}
	}

	/**
	 * Return editor value
	 */
	getEditorValue(removeSelectionMarkers: boolean = true): string {
		/**
		 * Triggered before {@link Jodit~getEditorValue|getEditorValue} executed.
		 * If returned not undefined getEditorValue will return this value
		 *
		 * @event beforeGetValueFromEditor
		 * @example
		 * ```javascript
		 * var editor = new Jodit("#redactor");
		 * editor.events.on('beforeGetValueFromEditor', function () {
		 *     return editor.editor.innerHTML.replace(/a/g, 'b');
		 * });
		 * ```
		 */
		let value: string;

		value = this.events.fire('beforeGetValueFromEditor');

		if (value !== undefined) {
			return value;
		}

		value = this.getNativeEditorValue().replace(
			consts.INVISIBLE_SPACE_REG_EXP,
			''
		);

		if (removeSelectionMarkers) {
			value = value.replace(
				/<span[^>]+id="jodit_selection_marker_[^>]+><\/span>/g,
				''
			);
		}

		if (value === '<br>') {
			value = '';
		}

		/**
		 * Triggered after  {@link Jodit~getEditorValue|getEditorValue} got value from wysiwyg.
		 * It can change new_value.value
		 *
		 * @event afterGetValueFromEditor
		 * @param string new_value
		 * @example
		 * ```javascript
		 * var editor = new Jodit("#redactor");
		 * editor.events.on('afterGetValueFromEditor', function (new_value) {
		 *     new_value.value = new_value.value.replace('a', 'b');
		 * });
		 * ```
		 */
		const new_value: { value: string } = { value };

		this.events.fire('afterGetValueFromEditor', new_value);

		return new_value.value;
	}

	getEditorText(): string {
		if (this.editor) {
			return this.editor.textContent || '';
		}

		const div: HTMLDivElement = this.create.inside.div();
		div.innerHTML = this.getElementValue();

		return div.textContent || '';
	}

	/**
	 * Set source element value and if set sync fill editor value
	 * When method was called without arguments - it is simple way to synchronize element to editor
	 *
	 * @param {string} [value]
	 */
	setElementValue(value?: string) {
		if (typeof value !== 'string' && value !== undefined) {
			throw new Error('value must be string');
		}

		if (value !== undefined) {
			if (this.element !== this.container) {
				if ((this.element as HTMLInputElement).value !== undefined) {
					(this.element as HTMLInputElement).value = value;
				} else {
					this.element.innerHTML = value;
				}
			}
		} else {
			value = this.getElementValue();
		}

		if (value !== this.getEditorValue()) {
			this.setEditorValue(value);
		}
	}

	private __callChangeCount = 0;

	/**
	 * Set editor html value and if set sync fill source element value
	 * When method was called without arguments - it is simple way to synchronize editor to element
	 * @event beforeSetValueToEditor
	 * @param {string} [value]
	 */
	setEditorValue(value?: string) {
		/**
		 * Triggered before  {@link Jodit~getEditorValue|setEditorValue} set value to wysiwyg.
		 *
		 * @event beforeSetValueToEditor
		 * @param string old_value
		 * @returns string | undefined | false
		 * @example
		 * ```javascript
		 * var editor = new Jodit("#redactor");
		 * editor.events.on('beforeSetValueToEditor', function (old_value) {
		 *     return old_value.value.replace('a', 'b');
		 * });
		 * editor.events.on('beforeSetValueToEditor', function () {
		 *     return false; // disable setEditorValue method
		 * });
		 * ```
		 */
		const newValue: string | undefined | false = this.events.fire(
			'beforeSetValueToEditor',
			value
		);

		if (newValue === false) {
			return;
		}

		if (typeof newValue === 'string') {
			value = newValue;
		}

		if (!this.editor) {
			if (value !== undefined) {
				this.setElementValue(value);
			}
			return; // try change value before init or after destruct
		}

		if (typeof value !== 'string' && value !== undefined) {
			throw new Error('value must be string');
		}

		if (value !== undefined && this.editor.innerHTML !== value) {
			this.setNativeEditorValue(value);
		}

		const old_value = this.getElementValue(),
			new_value = this.getEditorValue();

		if (
			old_value !== new_value &&
			this.__callChangeCount < SAFE_COUNT_CHANGE_CALL
		) {
			this.setElementValue(new_value);
			this.__callChangeCount += 1;

			try {
				this.events.fire('change', new_value, old_value);
			} finally {
				this.__callChangeCount = 0;
			}
		}
	}

	/**
	 * Register custom handler for command
	 *
	 * @example
	 * ```javascript
	 * var jodit = new Jodit('#editor);
	 *
	 * jodit.setEditorValue('test test test');
	 *
	 * jodit.registerCommand('replaceString', function (command, needle, replace) {
	 *      var value = this.getEditorValue();
	 *      this.setEditorValue(value.replace(needle, replace));
	 *      return false; // stop execute native command
	 * });
	 *
	 * jodit.execCommand('replaceString', 'test', 'stop');
	 *
	 * console.log(jodit.value); // stop test test
	 *
	 * // and you can add hotkeys for command
	 * jodit.registerCommand('replaceString', {
	 *    hotkeys: 'ctrl+r',
	 *    exec: function (command, needle, replace) {
	 *     var value = this.getEditorValue();
	 *     this.setEditorValue(value.replace(needle, replace));
	 *    }
	 * });
	 *
	 * ```
	 *
	 * @param {string} commandNameOriginal
	 * @param {ICommandType | Function} command
	 */
	registerCommand(
		commandNameOriginal: string,
		command: CustomCommand<IJodit>
	): IJodit {
		const commandName: string = commandNameOriginal.toLowerCase();

		if (this.commands[commandName] === undefined) {
			this.commands[commandName] = [];
		}

		this.commands[commandName].push(command);

		if (typeof command !== 'function') {
			const hotkeys: string | string[] | void =
				this.options.commandToHotkeys[commandName] ||
				this.options.commandToHotkeys[commandNameOriginal] ||
				command.hotkeys;

			if (hotkeys) {
				this.registerHotkeyToCommand(hotkeys, commandName);
			}
		}

		return this;
	}

	/**
	 * Register hotkey for command
	 *
	 * @param hotkeys
	 * @param commandName
	 */
	registerHotkeyToCommand(hotkeys: string | string[], commandName: string) {
		const shortcuts: string = asArray(hotkeys)
			.map(normalizeKeyAliases)
			.map(hotkey => hotkey + '.hotkey')
			.join(' ');

		this.events.off(shortcuts).on(shortcuts, () => {
			return this.execCommand(commandName); // because need `beforeCommand`
		});
	}

	/**
	 * Execute command editor
	 *
	 * @param  {string} command command. It supports all the
	 * {@link https://developer.mozilla.org/ru/docs/Web/API/Document/execCommand#commands} and a number of its own
	 * for example applyCSSProperty. Comand fontSize receives the second parameter px,
	 * formatBlock and can take several options
	 * @param  {boolean|string|int} showUI
	 * @param  {boolean|string|int} value
	 * @fires beforeCommand
	 * @fires afterCommand
	 * @example
	 * ```javascript
	 * this.execCommand('fontSize', 12); // sets the size of 12 px
	 * this.execCommand('underline');
	 * this.execCommand('formatBlock', 'p'); // will be inserted paragraph
	 * ```
	 */
	execCommand(
		command: string,
		showUI: any = false,
		value: null | any = null
	) {
		if (this.options.readonly && command !== 'selectall') {
			return;
		}

		let result: any;
		command = command.toLowerCase();

		/**
		 * Called before any command
		 * @event beforeCommand
		 * @param {string} command Command name in lowercase
		 * @param {string} second The second parameter for the command
		 * @param {string} third The third option is for the team
		 * @example
		 * ```javascript
		 * parent.events.on('beforeCommand', function (command) {
		 *  if (command === 'justifyCenter') {
		 *      var p = parent.getDocument().createElement('p')
		 *      parent.selection.insertNode(p)
		 *      parent.selection.setCursorIn(p);
		 *      p.style.textAlign = 'justyfy';
		 *      return false; // break execute native command
		 *  }
		 * })
		 * ```
		 */
		result = this.events.fire('beforeCommand', command, showUI, value);

		if (result !== false) {
			result = this.execCustomCommands(command, showUI, value);
		}

		if (result !== false) {
			this.selection.focus();

			if (command === 'selectall') {
				this.selection.select(this.editor, true);
			} else {
				try {
					result = this.editorDocument.execCommand(
						command,
						showUI,
						value
					);
				} catch {}
			}
		}

		/**
		 * It called after any command
		 * @event afterCommand
		 * @param {string} command name command
		 * @param {*} second The second parameter for the command
		 * @param {*} third The third option is for the team
		 */
		this.events.fire('afterCommand', command, showUI, value);

		this.setEditorValue(); // synchrony

		return result;
	}

	private execCustomCommands(
		commandName: string,
		second: any = false,
		third: null | any = null
	): false | void {
		commandName = commandName.toLowerCase();

		if (this.commands[commandName] !== undefined) {
			let result: any;

			const exec = (command: CustomCommand<Jodit>) => {
				let callback: ExecCommandCallback<Jodit>;

				if (typeof command === 'function') {
					callback = command;
				} else {
					callback = command.exec;
				}

				const resultCurrent: any = (callback as any).call(
					this,
					commandName,
					second,
					third
				);

				if (resultCurrent !== undefined) {
					result = resultCurrent;
				}
			};

			for (let i = 0; i < this.commands[commandName].length; i += 1) {
				exec(this.commands[commandName][i]);
			}

			return result;
		}
	}

	/**
	 * Disable selecting
	 */
	lock(name: string = 'any') {
		if (super.lock(name)) {
			this.__selectionLocked = this.selection.save();
			this.editor.classList.add('jodit_disabled');
			return true;
		}

		return false;
	}

	/**
	 * Enable selecting
	 */
	unlock() {
		if (super.unlock()) {
			this.editor.classList.remove('jodit_disabled');

			if (this.__selectionLocked) {
				this.selection.restore(this.__selectionLocked);
			}

			return true;
		}

		return false;
	}

	/**
	 * Return current editor mode: Jodit.MODE_WYSIWYG, Jodit.MODE_SOURCE or Jodit.MODE_SPLIT
	 * @return {number}
	 */
	getMode(): Modes {
		return this.mode;
	}

	isEditorMode(): boolean {
		return this.getRealMode() === consts.MODE_WYSIWYG;
	}

	/**
	 * Return current real work mode. When editor in MODE_SOURCE or MODE_WYSIWYG it will
	 * return them, but then editor in MODE_SPLIT it will return MODE_SOURCE if
	 * Textarea(CodeMirror) focused or MODE_WYSIWYG otherwise
	 *
	 * @example
	 * ```javascript
	 * var editor = new Jodit('#editor');
	 * console.log(editor.getRealMode());
	 * ```
	 */
	getRealMode(): Modes {
		if (this.getMode() !== consts.MODE_SPLIT) {
			return this.getMode();
		}

		const active: Element | null = this.ownerDocument.activeElement;

		if (
			active &&
			(Dom.isOrContains(this.editor, active) ||
				Dom.isOrContains(this.toolbar.container, active))
		) {
			return consts.MODE_WYSIWYG;
		}

		return consts.MODE_SOURCE;
	}

	/**
	 * Set current mode
	 *
	 * @fired beforeSetMode
	 * @fired afterSetMode
	 */
	setMode(mode: number | string) {
		const oldmode: Modes = this.getMode();
		const data = {
				mode: <Modes>parseInt(mode.toString(), 10)
			},
			modeClasses = [
				'jodit_wysiwyg_mode',
				'jodit_source_mode',
				'jodit_split_mode'
			];

		/**
		 * Triggered before {@link Jodit~setMode|setMode} executed. If returned false method stopped
		 * @event beforeSetMode
		 * @param {Object} data PlainObject {mode: {string}} In handler you can change data.mode
		 * @example
		 * ```javascript
		 * var editor = new Jodit("#redactor");
		 * editor.events.on('beforeSetMode', function (data) {
		 *     data.mode = Jodit.MODE_SOURCE; // not respond to the mode change. Always make the source code mode
		 * });
		 * ```
		 */
		if (this.events.fire('beforeSetMode', data) === false) {
			return;
		}

		this.mode = inArray(data.mode, [
			consts.MODE_SOURCE,
			consts.MODE_WYSIWYG,
			consts.MODE_SPLIT
		])
			? data.mode
			: consts.MODE_WYSIWYG;

		if (this.options.saveModeInStorage) {
			this.storage.set('jodit_default_mode', this.mode);
		}

		modeClasses.forEach(className => {
			this.container.classList.remove(className);
		});

		this.container.classList.add(modeClasses[this.mode - 1]);

		/**
		 * Triggered after {@link Jodit~setMode|setMode} executed
		 * @event afterSetMode
		 * @example
		 * ```javascript
		 * var editor = new Jodit("#redactor");
		 * editor.events.on('afterSetMode', function () {
		 *     editor.setEditorValue(''); // clear editor's value after change mode
		 * });
		 * ```
		 */
		if (oldmode !== this.getMode()) {
			this.events.fire('afterSetMode');
		}
	}

	/**
	 * Toggle editor mode WYSIWYG to TEXTAREA(CodeMirror) to SPLIT(WYSIWYG and TEXTAREA) to again WYSIWYG
	 *
	 * @example
	 * ```javascript
	 * var editor = new Jodit('#editor');
	 * editor.toggleMode();
	 * ```
	 */
	toggleMode() {
		let mode: number = this.getMode();
		if (
			inArray(mode + 1, [
				consts.MODE_SOURCE,
				consts.MODE_WYSIWYG,
				this.options.useSplitMode ? consts.MODE_SPLIT : 9
			])
		) {
			mode += 1;
		} else {
			mode = consts.MODE_WYSIWYG;
		}

		this.setMode(mode);
	}

	/**
	 * Switch on/off the editor into the disabled state.
	 * When in disabled, the user is not able to change the editor content
	 * This function firing the `disabled` event.
	 *
	 * @param {boolean} isDisabled
	 */
	setDisabled(isDisabled: boolean) {
		this.options.disabled = isDisabled;

		const readOnly: boolean = this.__wasReadOnly;

		this.setReadOnly(isDisabled || readOnly);
		this.__wasReadOnly = readOnly;

		if (this.editor) {
			this.editor.setAttribute('aria-disabled', isDisabled.toString());
			this.container.classList.toggle('jodit_disabled', isDisabled);
			this.events.fire('disabled', isDisabled);
		}
	}

	/**
	 * Return true if editor in disabled mode
	 */
	getDisabled(): boolean {
		return this.options.disabled;
	}

	/**
	 * Switch on/off the editor into the read-only state.
	 * When in readonly, the user is not able to change the editor content, but can still
	 * use some editor functions (show source code, print content, or seach).
	 * This function firing the `readonly` event.
	 *
	 * @param {boolean} isReadOnly
	 */
	setReadOnly(isReadOnly: boolean) {
		if (this.__wasReadOnly === isReadOnly) {
			return;
		}

		this.__wasReadOnly = isReadOnly;
		this.options.readonly = isReadOnly;

		if (isReadOnly) {
			this.editor && this.editor.removeAttribute('contenteditable');
		} else {
			this.editor && this.editor.setAttribute('contenteditable', 'true');
		}

		this.events && this.events.fire('readonly', isReadOnly);
	}

	/**
	 * Return true if editor in read-only mode
	 */
	getReadOnly(): boolean {
		return this.options.readonly;
	}

	/**
	 * Hook before init
	 */
	beforeInitHook(): any {
		// do nothing
	}

	/**
	 * Hook after init
	 */
	afterInitHook(): any {
		// do nothing
	}

	/**
	 * Try to find element by selector
	 * @param element
	 */
	private resolveElement(element: string | HTMLElement): HTMLElement {
		let resolved = element;

		if (typeof element === 'string') {
			try {
				resolved = this.ownerDocument.querySelector(
					element
				) as HTMLInputElement;
			} catch {
				throw new Error(
					'String "' + element + '" should be valid HTML selector'
				);
			}
		}

		// Duck checking
		if (
			!resolved ||
			typeof resolved !== 'object' ||
			resolved.nodeType !== Node.ELEMENT_NODE ||
			!resolved.cloneNode
		) {
			throw new Error(
				'Element "' +
					element +
					'" should be string or HTMLElement instance'
			);
		}

		return resolved;
	}

	/**
	 * Create instance of Jodit
	 * @constructor
	 *
	 * @param {HTMLInputElement | string} element Selector or HTMLElement
	 * @param {object} options Editor's options
	 */
	constructor(element: HTMLInputElement | string, options?: object) {
		super();

		this.options = new OptionsDefault(options) as Config;

		// in iframe it can be changed
		this.editorDocument = this.options.ownerDocument;
		this.editorWindow = this.options.ownerWindow;

		this.ownerDocument = this.options.ownerDocument;
		this.ownerWindow = this.options.ownerWindow;

		this.element = this.resolveElement(element);

		if (this.element.attributes) {
			Array.from(this.element.attributes).forEach((attr: Attr) => {
				const name: string = attr.name;
				let value: string | boolean | number = attr.value;

				if (
					(Jodit.defaultOptions as any)[name] !== undefined &&
					(!options || (options as any)[name] === undefined)
				) {
					if (['readonly', 'disabled'].indexOf(name) !== -1) {
						value = value === '' || value === 'true';
					}

					if (/^[0-9]+(\.)?([0-9]+)?$/.test(value.toString())) {
						value = Number(value);
					}

					(this.options as any)[name] = value;
				}
			});
		}

		if (this.options.events) {
			Object.keys(this.options.events).forEach((key: string) => {
				this.events.on(key, this.options.events[key]);
			});
		}

		this.container.classList.add('jodit_container');
		this.container.setAttribute('contenteditable', 'false');

		this.selection = new Select(this);
		this.events.on('removeMarkers', () => {
			if (this.selection) {
				this.selection.removeMarkers();
			}
		});

		this.observer = new Observer(this);

		let buffer: null | string = null;

		if (this.options.inline) {
			if (['TEXTAREA', 'INPUT'].indexOf(this.element.nodeName) === -1) {
				this.container = this.element as HTMLDivElement;
				this.element.setAttribute(
					this.__defaultClassesKey,
					this.element.className.toString()
				);

				buffer = this.container.innerHTML;

				this.container.innerHTML = '';
			}

			this.container.classList.add('jodit_inline');
			this.container.classList.add('jodit_container');
		}

		// actual for inline mode
		if (this.element !== this.container) {
			// hide source element
			if (this.element.style.display) {
				this.element.setAttribute(
					this.__defaultStyleDisplayKey,
					this.element.style.display
				);
			}

			this.element.style.display = 'none';
		}

		this.applyOptionsToToolbarContainer(this.container);

		this.workplace = this.create.div('jodit_workplace', {
			contenteditable: false
		});

		this.makeToolbar();

		if (this.options.textIcons) {
			this.container.classList.add('jodit_text_icons');
		}

		this.events.on(this.ownerWindow, 'resize', () => {
			if (this.events) {
				this.events.fire('resize');
			}
		});

		this.container.appendChild(this.workplace);
		this.statusbar = new StatusBar(this, this.container);

		this.workplace.appendChild(this.progress_bar);

		if (this.element.parentNode && this.element !== this.container) {
			this.element.parentNode.insertBefore(this.container, this.element);
		}

		this.id =
			this.element.getAttribute('id') || new Date().getTime().toString();

		this.editor = this.create.div('jodit_wysiwyg', {
			contenteditable: true,
			'aria-disabled': false,
			tabindex: this.options.tabIndex
		});

		this.workplace.appendChild(this.editor);

		this.setNativeEditorValue(this.getElementValue()); // Init value

		(async () => {
			await this.beforeInitHook();

			await this.events.fire('beforeInit', this);

			try {
				await Jodit.plugins.init(this);
			} catch (e) {
				console.error(e);
			}

			await this.__initEditor(buffer);

			if (this.isDestructed) {
				return;
			}

			const opt = this.options;

			if (
				opt.enableDragAndDropFileToEditor &&
				opt.uploader &&
				(opt.uploader.url || opt.uploader.insertImageAsBase64URI)
			) {
				this.uploader.bind(this.editor);
			}

			this.isInited = true;

			if (this.events) {
				await this.events.fire('afterInit', this);
				this.events.fire('afterConstructor', this);
			}

			await this.afterInitHook();
		})();
	}

	private makeToolbar() {
		if (!this.options.toolbar) {
			return;
		}

		let toolbarContainer: HTMLElement = this.create.div(
			'jodit_toolbar_container'
		);
		this.container.appendChild(toolbarContainer);

		if (
			this.options.toolbar instanceof HTMLElement ||
			typeof this.options.toolbar === 'string'
		) {
			toolbarContainer = this.resolveElement(this.options.toolbar);
		}

		this.applyOptionsToToolbarContainer(toolbarContainer);

		this.toolbar.build(
			splitArray(this.options.buttons).concat(this.options.extraButtons),
			toolbarContainer
		);

		const bs = this.options.toolbarButtonSize.toLowerCase();
		toolbarContainer.classList.add(
			'jodit_toolbar_size-' +
				(['middle', 'large', 'small'].indexOf(bs) !== -1
					? bs
					: 'middle')
		);
	}

	private applyOptionsToToolbarContainer(element: HTMLElement) {
		element.classList.add(
			'jodit_' + (this.options.theme || 'default') + '_theme'
		);

		if (this.options.zIndex) {
			element.style.zIndex = parseInt(
				this.options.zIndex.toString(),
				10
			).toString();
		}
	}

	isInited: boolean = false;

	private async __initEditor(buffer: null | string) {
		await this.__createEditor();

		if (this.isDestructed) {
			return;
		}

		// syncro
		if (this.element !== this.container) {
			this.setElementValue();
		} else {
			buffer !== null && this.setEditorValue(buffer); // inline mode
		}

		Jodit.instances[this.id] = this;

		let mode: number = this.options.defaultMode;

		if (this.options.saveModeInStorage) {
			const localMode = this.storage.get('jodit_default_mode');

			if (typeof localMode === 'string') {
				mode = parseInt(localMode, 10);
			}
		}

		this.setMode(mode);

		if (this.options.readonly) {
			this.setReadOnly(true);
		}

		if (this.options.disabled) {
			this.setDisabled(true);
		}

		// if enter plugin not installed
		try {
			this.editorDocument.execCommand(
				'defaultParagraphSeparator',
				false,
				this.options.enter.toLowerCase()
			);
		} catch {}

		// fix for native resizing
		try {
			this.editorDocument.execCommand(
				'enableObjectResizing',
				false,
				'false'
			);
		} catch {}

		try {
			this.editorDocument.execCommand(
				'enableInlineTableEditing',
				false,
				'false'
			);
		} catch {}
	}

	/**
	 * Create main DIV element and replace source textarea
	 *
	 * @private
	 */
	private async __createEditor() {
		const defaultEditorAreae: HTMLElement = this.editor;

		const stayDefault: boolean | undefined = await this.events.fire(
			'createEditor',
			this
		);

		if (this.isDestructed) {
			return;
		}

		if (stayDefault === false) {
			Dom.safeRemove(defaultEditorAreae);
		}

		if (this.options.editorCssClass) {
			this.editor.classList.add(this.options.editorCssClass);
		}

		if (this.options.style) {
			css(this.editor, this.options.style);
		}

		// proxy events
		this.events
			.on('synchro', () => {
				this.setEditorValue();
			})
			.on('focus', () => (this.editorIsActive = true))
			.on('blur', () => (this.editorIsActive = false))
			.on(
				this.editor,
				'selectionchange selectionstart keydown keyup keypress mousedown mouseup mousepress ' +
					'click copy cut dragstart drop dragover paste resize touchstart touchend focus blur',
				(event: Event): false | void => {
					if (this.options.readonly) {
						return;
					}

					if (this.events && this.events.fire) {
						if (this.events.fire(event.type, event) === false) {
							return false;
						}

						this.setEditorValue();
					}
				}
			);

		if (this.options.spellcheck) {
			this.editor.setAttribute('spellcheck', 'true');
		}

		// direction
		if (this.options.direction) {
			const direction =
				this.options.direction.toLowerCase() === 'rtl' ? 'rtl' : 'ltr';

			this.editor.style.direction = direction;
			this.container.style.direction = direction;
			this.editor.setAttribute('dir', direction);
			this.container.setAttribute('dir', direction);

			this.toolbar.setDirection(direction);
		}

		if (this.options.triggerChangeEvent) {
			this.events.on(
				'change',
				debounce(() => {
					this.events && this.events.fire(this.element, 'change');
				}, this.defaultTimeout)
			);
		}
	}

	/**
	 * Jodit's Destructor. Remove editor, and return source input
	 */
	destruct() {
		if (this.isDestructed) {
			return;
		}

		/**
		 * Triggered before {@link events:beforeDestruct|beforeDestruct} executed. If returned false method stopped
		 *
		 * @event beforeDestruct
		 * @example
		 * ```javascript
		 * var editor = new Jodit("#redactor");
		 * editor.events.on('beforeDestruct', function (data) {
		 *     return false;
		 * });
		 * ```
		 */
		if (this.events.fire('beforeDestruct') === false) {
			return;
		}

		if (!this.editor) {
			return;
		}

		const buffer: string = this.getEditorValue();

		if (this.element !== this.container) {
			if (this.element.hasAttribute(this.__defaultStyleDisplayKey)) {
				const attr = this.element.getAttribute(
					this.__defaultStyleDisplayKey
				);

				if (attr) {
					this.element.style.display = attr;
					this.element.removeAttribute(this.__defaultStyleDisplayKey);
				}
			} else {
				this.element.style.display = '';
			}
		} else {
			if (this.element.hasAttribute(this.__defaultClassesKey)) {
				this.element.className =
					this.element.getAttribute(this.__defaultClassesKey) || '';
				this.element.removeAttribute(this.__defaultClassesKey);
			}
		}

		if (
			this.element.hasAttribute('style') &&
			!this.element.getAttribute('style')
		) {
			this.element.removeAttribute('style');
		}

		this.observer.destruct();
		this.statusbar.destruct();

		delete this.observer;
		delete this.statusbar;

		delete this.storage;

		this.buffer.clear();
		delete this.buffer;

		this.components.forEach((component: Component) => {
			if (
				component.destruct !== undefined &&
				typeof component.destruct === 'function' &&
				!component.isDestructed
			) {
				component.destruct();
			}
		});

		this.components.length = 0;
		this.commands = {};

		delete this.selection;
		this.__selectionLocked = null;

		this.events.off(this.ownerWindow);
		this.events.off(this.ownerDocument);
		this.events.off(this.ownerDocument.body);
		this.events.off(this.element);
		this.events.off(this.editor);

		Dom.safeRemove(this.workplace);
		Dom.safeRemove(this.editor);
		Dom.safeRemove(this.progress_bar);
		Dom.safeRemove(this.iframe);

		if (this.container !== this.element) {
			Dom.safeRemove(this.container);
		}

		delete this.workplace;
		delete this.editor;
		delete this.progress_bar;
		delete this.iframe;

		// inline mode
		if (this.container === this.element) {
			this.element.innerHTML = buffer;
		}

		delete Jodit.instances[this.id];

		super.destruct();

		delete this.container;
	}
}
