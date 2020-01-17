import {
	Child,
	Context,
	Default,
	Environment,
	Intrinsic,
	Props,
	Renderer,
	Root,
} from "./crank";

function updateProps(el: HTMLElement, props: Props, newProps: Props): void {
	for (let name in Object.assign({}, props, newProps)) {
		// TODO: throw an error if event props are found
		if (name === "children") {
			continue;
		}

		const value = props[name];
		const newValue = newProps[name];
		if (name === "style") {
			if (newValue == null) {
				el.removeAttribute("style");
			} else if (typeof newValue === "string") {
				el.style.cssText = newValue;
			} else {
				for (const styleName in Object.assign({}, value, newValue)) {
					const styleValue = value && value[styleName];
					const newStyleValue = newValue && newValue[styleName];
					if (newStyleValue == null) {
						el.style.removeProperty(styleName);
					} else if (styleValue !== newStyleValue) {
						el.style.setProperty(styleName, newStyleValue);
					}
				}
			}
		} else if (name in el) {
			(el as any)[name] = newValue;
		} else {
			if (newValue === true) {
				el.setAttribute(name, "");
			} else if (newValue === false || newValue == null) {
				el.removeAttribute(name);
			} else {
				el.setAttribute(name, newValue);
			}
		}
	}
}

// TODO: improve this algorithm
// https://stackoverflow.com/questions/59418120/what-is-the-most-efficient-way-to-update-the-childnodes-of-a-dom-node-with-an-ar
function updateChildren(
	el: HTMLElement,
	children: (Node | string)[] = [],
): void {
	if (el.childNodes.length === 0) {
		const fragment = document.createDocumentFragment();
		for (let child of children) {
			if (typeof child === "string") {
				child = document.createTextNode(child);
			}

			fragment.appendChild(child);
		}

		el.appendChild(fragment);
		return;
	}

	let oldChild = el.firstChild;
	for (const newChild of children) {
		if (oldChild === null) {
			el.appendChild(
				typeof newChild === "string"
					? document.createTextNode(newChild)
					: newChild,
			);
		} else if (typeof newChild === "string") {
			if (oldChild.nodeType === Node.TEXT_NODE) {
				if (oldChild.nodeValue !== newChild) {
					oldChild.nodeValue = newChild;
				}

				oldChild = oldChild.nextSibling;
			} else {
				el.insertBefore(document.createTextNode(newChild), oldChild);
			}
		} else if (oldChild !== newChild) {
			el.insertBefore(newChild, oldChild);
		} else {
			oldChild = oldChild.nextSibling;
		}
	}

	while (oldChild !== null) {
		const nextSibling = oldChild.nextSibling;
		el.removeChild(oldChild);
		oldChild = nextSibling;
	}
}

export const env: Environment<HTMLElement> = {
	*[Root](this: Context, {node}): Generator<HTMLElement> {
		try {
			for (const {node: newNode} of this) {
				if (node !== newNode) {
					updateChildren(node);
					node = newNode;
				}

				updateChildren(node, this.childNodes);
				yield node;
			}
		} finally {
			updateChildren(node);
		}
	},
	[Default](tag: string): Intrinsic<HTMLElement> {
		return function* defaultDOM(this: Context): Generator<HTMLElement> {
			const node = document.createElement(tag);
			let props: Props = {};
			let prevChildNodes: (string | HTMLElement)[] = [];
			for (const props1 of this) {
				updateProps(node, props, props1);
				if (
					!("innerHTML" in props1) &&
					(this.childNodes.length > 0 || prevChildNodes.length > 0)
				) {
					updateChildren(node, this.childNodes);
					prevChildNodes = this.childNodes;
				}

				yield node;
				props = props1;
			}
		};
	},
};

export class DOMRenderer extends Renderer<HTMLElement> {
	env = env;
}

export const renderer = new DOMRenderer();

export function render(
	child: Child,
	node: HTMLElement,
): Promise<Context | undefined> | Context | undefined {
	return renderer.render(child, node);
}