/*!
 * Jodit Editor (https://xdsoft.net/jodit/)
 * Licensed under GNU General Public License version 2 or later or a commercial license or MIT;
 * For GPL see LICENSE-GPL.txt in the project root for license information.
 * For MIT see LICENSE-MIT.txt in the project root for license information.
 * For commercial licenses see https://xdsoft.net/jodit/commercial/
 * Copyright (c) 2013-2019 Valeriy Chupurnov. All rights reserved. https://xdsoft.net
 */

import { IViewBased } from '../types/view';
import { Component } from './Component';
import { css } from './helpers/css';
import { ToolbarIcon } from './toolbar/icon';
import { Dom } from './Dom';

export interface Action {
	icon?: string;
	title?: string;
	exec?: (this: ContextMenu, e: MouseEvent) => false | void;
}

/**
 * Module to generate context menu
 *
 * @module ContextMenu
 * @param {Object} parent Jodit main object
 */
export class ContextMenu extends Component {
	private context: HTMLElement;

	/**
	 * Hide context menu
	 *
	 * @method hide
	 */
	hide = () => {
		this.context.classList.remove('jodit_context_menu-show');
		this.jodit.ownerWindow.removeEventListener('mouseup', this.hide);
	};

	/**
	 * Generate and show context menu
	 *
	 * @method show
	 * @param {number} x Global coordinate by X
	 * @param {number} y Global coordinate by Y
	 * @param {Action[]} actions Array with plainobjects {icon: 'bin', title: 'Delete', exec: function () { do smth}}
	 * @param {number} zIndex
	 * @example
	 * ```javascript
	 * parent.show(e.clientX, e.clientY, [{icon: 'bin', title: 'Delete', exec: function () { alert(1) }]);
	 * ```
	 */
	show(
		x: number,
		y: number,
		actions: Array<false | Action>,
		zIndex?: number
	) {
		const self = this;
		if (!Array.isArray(actions)) {
			return;
		}

		if (zIndex) {
			this.context.style.zIndex = zIndex.toString();
		}

		this.context.innerHTML = '';

		actions.forEach(item => {
			if (!item) {
				return;
			}

			const title = self.jodit.i18n(item.title || '');

			const action = this.jodit.create.fromHTML(
				`<a title="${title}" data-icon="${item.icon}"  href="javascript:void(0)">` +
					(item.icon ? ToolbarIcon.getIcon(item.icon) : '') +
					'<span></span></a>'
			) as HTMLAnchorElement;

			const span: HTMLSpanElement = action.querySelector(
				'span'
			) as HTMLSpanElement;

			action.addEventListener('click', (e: MouseEvent) => {
				item.exec && item.exec.call(self, e);
				self.hide();
				return false;
			});

			span.textContent = title;
			self.context.appendChild(action);
		});

		css(self.context, {
			left: x,
			top: y
		});

		this.jodit.events.on(
			this.jodit.ownerWindow,
			'mouseup jodit_close_dialog',
			self.hide
		);

		this.context.classList.add('jodit_context_menu-show');
	}

	constructor(editor: IViewBased) {
		super(editor);

		this.context = editor.create.div('jodit_context_menu', {
			'data-editor_id': this.jodit.id
		});

		editor.ownerDocument.body.appendChild(this.context);
	}

	destruct() {
		Dom.safeRemove(this.context);
		delete this.context;
		this.jodit.events.off(this.jodit.ownerWindow, 'mouseup', this.hide);
		super.destruct();
	}
}
