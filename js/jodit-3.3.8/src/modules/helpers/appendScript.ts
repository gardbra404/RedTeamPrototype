/*!
 * Jodit Editor (https://xdsoft.net/jodit/)
 * Licensed under GNU General Public License version 2 or later or a commercial license or MIT;
 * For GPL see LICENSE-GPL.txt in the project root for license information.
 * For MIT see LICENSE-MIT.txt in the project root for license information.
 * For commercial licenses see https://xdsoft.net/jodit/commercial/
 * Copyright (c) 2013-2019 Valeriy Chupurnov. All rights reserved. https://xdsoft.net
 */

import { completeUrl } from './completeUrl';

export type Loader = (url: string, doc: Document) => Promise<any>;

export type CallbackAndElement = {
	callback: EventListener;
	element: HTMLElement;
};

const alreadyLoadedList = new Map<string, Promise<any>>();

const cacheLoaders = (loader: Loader): Loader => {
	return (url: string, doc: Document): Promise<any> => {
		if (alreadyLoadedList.has(url)) {
			return <Promise<any>>alreadyLoadedList.get(url);
		}

		const promise = loader(url, doc);

		alreadyLoadedList.set(url, promise);

		return promise;
	};
};

/**
 * Append script in document and call callback function after download
 *
 * @param url
 * @param callback
 * @param className
 * @param doc
 */
export const appendScript = (
	url: string,
	callback: (this: HTMLElement, e: Event) => any,
	className: string,
	doc: Document
): CallbackAndElement => {
	const script: HTMLScriptElement = doc.createElement('script');
	script.className = className;
	script.type = 'text/javascript';

	if (callback !== undefined) {
		script.addEventListener('load', callback);
	}

	script.src = completeUrl(url);

	doc.body.appendChild(script);

	return {
		callback,
		element: script
	};
};

/**
 * Load script and return promise
 */
export const appendScriptAsync = cacheLoaders(
	(url: string, doc: Document = document) => {
		return new Promise((resolve, reject) => {
			const { element } = appendScript(url, resolve, '', doc);
			element.addEventListener('error', reject);
		});
	}
);

/**
 * Download CSS style script
 *
 * @param url
 * @param doc
 */
export const appendStyleAsync = cacheLoaders(
	(url: string, doc: Document = document): Promise<HTMLElement> => {
		return new Promise((resolve, reject) => {
			const link = doc.createElement('link');

			link.rel = 'stylesheet';
			link.media = 'all';
			link.crossOrigin = 'anonymous';

			link.addEventListener('load', () => resolve(link));
			link.addEventListener('error', reject);

			link.href = completeUrl(url);

			doc.body.appendChild(link);
		});
	}
);
