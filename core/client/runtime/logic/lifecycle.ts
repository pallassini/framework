export type Disposer = () => void;

const nodeDisposers = new WeakMap<globalThis.Node, Set<Disposer>>();

function runNodeDisposers(node: globalThis.Node): void {
	const set = nodeDisposers.get(node);
	if (!set) return;
	nodeDisposers.delete(node);
	for (const dispose of set) {
		try {
			dispose();
		} catch {
			/* */
		}
	}
}

export function onNodeDispose(node: globalThis.Node, dispose: Disposer): Disposer {
	let set = nodeDisposers.get(node);
	if (!set) {
		set = new Set<Disposer>();
		nodeDisposers.set(node, set);
	}
	set.add(dispose);
	return () => {
		const curr = nodeDisposers.get(node);
		if (!curr) return;
		curr.delete(dispose);
		if (curr.size === 0) nodeDisposers.delete(node);
	};
}

export function disposeNodeTree(node: globalThis.Node): void {
	if (
		node.nodeType === globalThis.Node.ELEMENT_NODE ||
		node.nodeType === globalThis.Node.DOCUMENT_FRAGMENT_NODE
	) {
		const children = Array.from(node.childNodes);
		for (const child of children) disposeNodeTree(child as globalThis.Node);
	}
	runNodeDisposers(node);
}

export function replaceChildrenWithDispose(
	parent: Element | DocumentFragment,
	...next: globalThis.Node[]
): void {
	const prev = Array.from(parent.childNodes);
	for (const node of prev) disposeNodeTree(node);
	parent.replaceChildren(...next);
}
