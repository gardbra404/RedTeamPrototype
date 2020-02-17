/*!
 * Jodit Editor (https://xdsoft.net/jodit/)
 * Licensed under GNU General Public License version 2 or later or a commercial license or MIT;
 * For GPL see LICENSE-GPL.txt in the project root for license information.
 * For MIT see LICENSE-MIT.txt in the project root for license information.
 * For commercial licenses see https://xdsoft.net/jodit/commercial/
 * Copyright (c) 2013-2019 Valeriy Chupurnov. All rights reserved. https://xdsoft.net
 */

import { IControlType, IJodit, IPlugin } from '../../types';
import { Config } from '../../Config';
import { TEXT_HTML, TEXT_PLAIN } from '../../constants';
import { stripTags } from '../../modules/helpers/html';
import { getDataTransfer } from './paste';

Config.prototype.controls.cut = {
	command: 'cut',
	isDisable: (editor: IJodit) => editor.selection.isCollapsed(),
	tooltip: 'Cut selection'
} as IControlType;

Config.prototype.controls.copy = {
	command: 'copy',
	isDisable: (editor: IJodit) => editor.selection.isCollapsed(),
	tooltip: 'Copy selection'
} as IControlType;

export const pluginKey = 'clipboard';

/**
 * Clipboard plugin - cut and copy functionality
 */
export class clipboard implements IPlugin {
	init(editor: IJodit): void {
		editor.events
			.on(
				`copy.${pluginKey} cut.${pluginKey}`,
				(event: ClipboardEvent): false | void => {
					const selectedText = editor.selection.getHTML();

					const clipboardData =
						getDataTransfer(event) ||
						getDataTransfer(editor.editorWindow as any) ||
						getDataTransfer((event as any).originalEvent);

					if (clipboardData) {
						clipboardData.setData(TEXT_PLAIN, stripTags(selectedText));
						clipboardData.setData(TEXT_HTML, selectedText);
					}

					editor.buffer.set(pluginKey, selectedText);

					if (event.type === 'cut') {
						editor.selection.remove();
						editor.selection.focus();
					}

					event.preventDefault();

					editor?.events?.fire('afterCopy', selectedText);
				}
			)
	}

	destruct(editor: IJodit): void {
		editor?.buffer?.set(pluginKey, '');
		editor?.events?.off('.' + pluginKey);
	}
}
