/*!
 * Jodit Editor (https://xdsoft.net/jodit/)
 * Licensed under GNU General Public License version 2 or later or a commercial license or MIT;
 * For GPL see LICENSE-GPL.txt in the project root for license information.
 * For MIT see LICENSE-MIT.txt in the project root for license information.
 * For commercial licenses see https://xdsoft.net/jodit/commercial/
 * Copyright (c) 2013-2019 Valeriy Chupurnov. All rights reserved. https://xdsoft.net
 */

import { IS_IE } from '../../constants';

let $$temp: number = 1;

/**
 * Find all elements by selector and return Array. If it did not find any element it return empty array
 *
 * @example
 * ```javascript
 * Jodit.modules.Helpres.$$('.someselector').forEach(function (elm) {
 *      elm.addEventListener('click', function () {
 *          alert(''Clicked');
 *      });
 * })
 * ```
 * @param selector CSS like selector
 * @param root
 *
 * @return {HTMLElement[]}
 */
export const $$ = (
	selector: string,
	root: HTMLElement | HTMLDocument
): HTMLElement[] => {
	let result: NodeList;

	if (
		/:scope/.test(selector) &&
		IS_IE &&
		!(root && root.nodeType === Node.DOCUMENT_NODE)
	) {
		const id: string = (root as HTMLElement).id,
			temp_id: string =
				id ||
				'_selector_id_' + ('' + Math.random()).slice(2) + $$temp++;

		selector = selector.replace(/:scope/g, '#' + temp_id);

		!id && (root as HTMLElement).setAttribute('id', temp_id);

		result = (root.parentNode as HTMLElement).querySelectorAll(selector);

		if (!id) {
			(root as HTMLElement).removeAttribute('id');
		}
	} else {
		result = root.querySelectorAll(selector);
	}

	return [].slice.call(result);
};

export const getXPathByElement = (
	element: HTMLElement,
	root: HTMLElement
): string => {
	if (!element || element.nodeType !== 1) {
		return '';
	}

	if (!element.parentNode || root === element) {
		return '';
	}

	if (element.id) {
		return "//*[@id='" + element.id + "']";
	}

	const sames: Node[] = [].filter.call(
		element.parentNode.childNodes,
		(x: Node) => x.nodeName === element.nodeName
	);

	return (
		getXPathByElement(element.parentNode as HTMLElement, root) +
		'/' +
		element.nodeName.toLowerCase() +
		(sames.length > 1
			? '[' + (Array.from(sames).indexOf(element) + 1) + ']'
			: '')
	);
};
