import type { Plugin } from "vite";
import ts from "typescript";

/**
 * Di default i figli di `<case>` non devono essere valutati finché il case non matcha
 * (il JSX standard li valuta subito come argomento di `jsx("case", …)`).
 *
 * Trasformazione: `children: <expr>` → `children: () => <expr>` salvo:
 * - `preload` truthy su quel `<case>`
 * - `preload` truthy sul `<switch>` genitore (preload di tutti i branch)
 * - `children` è già una funzione (factory manuale)
 *
 * Rimuove `preload` dall’oggetto emesso (solo hint per il plugin).
 */

function isJsxCall(node: ts.CallExpression): boolean {
	const e = node.expression;
	if (ts.isIdentifier(e)) return e.text === "jsx" || e.text === "jsxs" || e.text === "jsxDEV";
	if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.name)) {
		return e.name.text === "jsx" || e.name.text === "jsxs" || e.name.text === "jsxDEV";
	}
	return false;
}

function getJsxStringTag(node: ts.CallExpression): string | undefined {
	const a0 = node.arguments[0];
	if (ts.isStringLiteralLike(a0)) return a0.text;
	return undefined;
}

function getPropsArg(node: ts.CallExpression): ts.Expression | undefined {
	return node.arguments[1];
}

function isTruthyPreload(exp: ts.Expression | undefined): boolean {
	if (!exp) return false;
	return exp.kind === ts.SyntaxKind.TrueKeyword;
}

function getPropInitializer(
	obj: ts.ObjectLiteralExpression,
	name: string,
): ts.Expression | undefined {
	for (const p of obj.properties) {
		if (!ts.isPropertyAssignment(p)) continue;
		if (ts.isIdentifier(p.name) && p.name.text === name) return p.initializer;
		if (ts.isStringLiteral(p.name) && p.name.text === name) return p.initializer;
	}
	return undefined;
}

function hasSpread(obj: ts.ObjectLiteralExpression): boolean {
	return obj.properties.some((p) => ts.isSpreadAssignment(p));
}

function isZeroArityFunction(node: ts.Expression | undefined): boolean {
	if (!node) return false;
	if (ts.isArrowFunction(node)) return node.parameters.length === 0;
	if (ts.isFunctionExpression(node)) return node.parameters.length === 0;
	return false;
}

function isFragmentJsx(ce: ts.CallExpression): boolean {
	const a0 = ce.arguments[0];
	return ts.isIdentifier(a0) && a0.text === "Fragment";
}

function getIntrinsicJsxTagName(opening: ts.JsxOpeningLike): string | undefined {
	const tag = opening.tagName;
	if (ts.isIdentifier(tag)) return tag.text;
	return undefined;
}

function hasJsxSpread(attrs: ts.JsxAttributes): boolean {
	return attrs.properties.some((p) => ts.isJsxSpreadAttribute(p));
}

function isTruthyPreloadJsxAttr(attr: ts.JsxAttribute): boolean {
	const nm = ts.isIdentifier(attr.name) ? attr.name.text : ts.isStringLiteral(attr.name) ? attr.name.text : "";
	if (nm !== "preload") return false;
	if (attr.initializer == null) return true;
	if (ts.isJsxExpression(attr.initializer)) {
		const ex = attr.initializer.expression;
		return ex != null && ex.kind === ts.SyntaxKind.TrueKeyword;
	}
	return false;
}

function getJsxAttrInitializer(attrs: ts.JsxAttributes, name: string): ts.Expression | undefined {
	for (const p of attrs.properties) {
		if (!ts.isJsxAttribute(p)) continue;
		const nm = ts.isIdentifier(p.name) ? p.name.text : ts.isStringLiteral(p.name) ? p.name.text : "";
		if (nm !== name) continue;
		if (p.initializer == null) return undefined;
		if (ts.isJsxExpression(p.initializer)) return p.initializer.expression;
		return undefined;
	}
	return undefined;
}

function jsxAttrsHaveTruthyPreload(attrs: ts.JsxAttributes): boolean {
	for (const p of attrs.properties) {
		if (ts.isJsxAttribute(p) && isTruthyPreloadJsxAttr(p)) return true;
	}
	return false;
}

function omitPreloadFromJsxAttrs(factory: ts.NodeFactory, attrs: ts.JsxAttributes): ts.JsxAttributes {
	const props = attrs.properties.filter((p) => !(ts.isJsxAttribute(p) && isTruthyPreloadJsxAttr(p)));
	return factory.updateJsxAttributes(attrs, props);
}

/** Figli JSX tra tag (esclusi whitespace-only). */
function jsxElementBodyToExpression(
	factory: ts.NodeFactory,
	jsxChildren: readonly ts.JsxChild[],
): ts.Expression | undefined {
	const nonWs = jsxChildren.filter(
		(c) => !(ts.isJsxText(c) && c.getText().replace(/\s+/g, "") === ""),
	);
	if (nonWs.length === 0) return undefined;
	if (nonWs.length === 1) {
		const only = nonWs[0]!;
		if (ts.isJsxExpression(only)) {
			const ex = only.expression;
			if (ex != null) return ex;
			return undefined;
		}
		if (ts.isJsxElement(only) || ts.isJsxFragment(only) || ts.isJsxSelfClosingElement(only))
			return only;
	}
	return factory.createJsxFragment(
		factory.createJsxOpeningFragment(),
		factory.createNodeArray(nonWs),
		factory.createJsxJsxClosingFragment(),
	);
}

function omitPreloadFromObject(
	factory: ts.NodeFactory,
	obj: ts.ObjectLiteralExpression,
): ts.ObjectLiteralExpression {
	const props = obj.properties.filter((p) => {
		if (!ts.isPropertyAssignment(p)) return true;
		const nm = ts.isIdentifier(p.name) ? p.name.text : ts.isStringLiteral(p.name) ? p.name.text : "";
		return nm !== "preload";
	});
	return factory.updateObjectLiteralExpression(obj, props);
}

function wrapChildrenLazy(factory: ts.NodeFactory, childrenExpr: ts.Expression): ts.Expression {
	return factory.createArrowFunction(
		undefined,
		undefined,
		[],
		undefined,
		factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
		childrenExpr,
	);
}

function rebuildObjectWithChildren(
	factory: ts.NodeFactory,
	obj: ts.ObjectLiteralExpression,
	newChildren: ts.Expression,
	stripPreload: boolean,
): ts.ObjectLiteralExpression {
	let base = obj;
	if (stripPreload) base = omitPreloadFromObject(factory, base);

	const out: ts.ObjectLiteralElementLike[] = [];
	let replaced = false;
	for (const p of base.properties) {
		if (ts.isPropertyAssignment(p)) {
			const nm = ts.isIdentifier(p.name) ? p.name.text : ts.isStringLiteral(p.name) ? p.name.text : "";
			if (nm === "children") {
				out.push(factory.updatePropertyAssignment(p, p.name, newChildren));
				replaced = true;
				continue;
			}
		}
		out.push(p);
	}
	if (!replaced) {
		out.push(factory.createPropertyAssignment("children", newChildren));
	}
	return factory.updateObjectLiteralExpression(base, out);
}

function transformCaseCall(
	factory: ts.NodeFactory,
	context: ts.TransformationContext,
	ce: ts.CallExpression,
	switchPreload: boolean,
): ts.CallExpression {
	const tag = getJsxStringTag(ce);
	if (tag !== "case") return ce;

	const propsArg = getPropsArg(ce);
	if (!propsArg || !ts.isObjectLiteralExpression(propsArg) || hasSpread(propsArg)) return ce;

	const casePreload = isTruthyPreload(getPropInitializer(propsArg, "preload"));
	const eager = switchPreload || casePreload;

	let childrenInit = getPropInitializer(propsArg, "children");
	if (!childrenInit) {
		const stripped = omitPreloadFromObject(factory, propsArg);
		return factory.updateCallExpression(ce, ce.expression, ce.typeArguments, [
			ce.arguments[0],
			stripped,
			...ce.arguments.slice(2),
		]);
	}

	let nextChildren = childrenInit;
	if (!eager && !isZeroArityFunction(childrenInit)) {
		nextChildren = wrapChildrenLazy(factory, childrenInit);
	}
	nextChildren = deepTransformSwitchesInExpr(factory, context, nextChildren);

	let newProps = rebuildObjectWithChildren(factory, propsArg, nextChildren, true);
	return factory.updateCallExpression(ce, ce.expression, ce.typeArguments, [
		ce.arguments[0],
		newProps,
		...ce.arguments.slice(2),
	]);
}

function setJsxChildrenAttribute(
	factory: ts.NodeFactory,
	attrs: ts.JsxAttributes,
	childrenExpr: ts.Expression,
	stripPreload: boolean,
): ts.JsxAttributes {
	const base = stripPreload ? omitPreloadFromJsxAttrs(factory, attrs) : attrs;
	const props: ts.JsxAttributeLike[] = [];
	let replaced = false;
	for (const p of base.properties) {
		if (ts.isJsxAttribute(p)) {
			const nm = ts.isIdentifier(p.name) ? p.name.text : ts.isStringLiteral(p.name) ? p.name.text : "";
			if (nm === "children") {
				props.push(
					factory.createJsxAttribute(
						factory.createIdentifier("children"),
						factory.createJsxExpression(undefined, childrenExpr),
					),
				);
				replaced = true;
				continue;
			}
		}
		props.push(p);
	}
	if (!replaced) {
		props.push(
			factory.createJsxAttribute(
				factory.createIdentifier("children"),
				factory.createJsxExpression(undefined, childrenExpr),
			),
		);
	}
	return factory.updateJsxAttributes(base, props);
}

function transformCaseJsxSelfClosing(
	factory: ts.NodeFactory,
	context: ts.TransformationContext,
	node: ts.JsxSelfClosingElement,
	switchPreload: boolean,
): ts.JsxSelfClosingElement {
	if (getIntrinsicJsxTagName(node) !== "case") return node;
	if (hasJsxSpread(node.attributes)) return node;

	const casePreload = jsxAttrsHaveTruthyPreload(node.attributes);
	const eager = switchPreload || casePreload;
	const childrenInit = getJsxAttrInitializer(node.attributes, "children");
	if (!childrenInit) return node;

	let nextChildren = childrenInit;
	if (!eager && !isZeroArityFunction(childrenInit)) {
		nextChildren = wrapChildrenLazy(factory, childrenInit);
	}
	nextChildren = deepTransformSwitchesInExpr(factory, context, nextChildren);

	const newAttrs = setJsxChildrenAttribute(factory, node.attributes, nextChildren, true);
	return factory.updateJsxSelfClosingElement(node, node.tagName, node.typeArguments, newAttrs);
}

function transformCaseJsxElement(
	factory: ts.NodeFactory,
	context: ts.TransformationContext,
	caseNode: ts.JsxElement,
	switchPreload: boolean,
): ts.JsxSelfClosingElement | ts.JsxElement {
	const opening = caseNode.openingElement;
	if (getIntrinsicJsxTagName(opening) !== "case") return caseNode;
	if (hasJsxSpread(opening.attributes)) return caseNode;

	const casePreload = jsxAttrsHaveTruthyPreload(opening.attributes);
	const eager = switchPreload || casePreload;

	const childrenFromAttr = getJsxAttrInitializer(opening.attributes, "children");
	const bodyExpr = jsxElementBodyToExpression(factory, caseNode.children);

	if (childrenFromAttr != null && bodyExpr != null) return caseNode;

	if (childrenFromAttr != null && bodyExpr == null) {
		let nextChildren = childrenFromAttr;
		if (!eager && !isZeroArityFunction(childrenFromAttr)) {
			nextChildren = wrapChildrenLazy(factory, childrenFromAttr);
		}
		nextChildren = deepTransformSwitchesInExpr(factory, context, nextChildren);
		const newAttrs = setJsxChildrenAttribute(factory, opening.attributes, nextChildren, true);
		return factory.createJsxSelfClosingElement(opening.tagName, opening.typeArguments, newAttrs);
	}

	if (bodyExpr == null) return caseNode;

	let nextChildren = bodyExpr;
	if (!eager) nextChildren = wrapChildrenLazy(factory, bodyExpr);
	nextChildren = deepTransformSwitchesInExpr(factory, context, nextChildren);

	const newAttrs = setJsxChildrenAttribute(factory, opening.attributes, nextChildren, true);
	return factory.createJsxSelfClosingElement(opening.tagName, opening.typeArguments, newAttrs);
}

function transformSwitchJsxElement(
	factory: ts.NodeFactory,
	context: ts.TransformationContext,
	el: ts.JsxElement,
): ts.JsxElement {
	const opening = el.openingElement;
	if (getIntrinsicJsxTagName(opening) !== "switch") return el;
	if (hasJsxSpread(opening.attributes)) return el;

	const switchPreload = jsxAttrsHaveTruthyPreload(opening.attributes);
	const newOpening = factory.updateJsxOpeningElement(
		opening,
		opening.tagName,
		opening.typeArguments,
		omitPreloadFromJsxAttrs(factory, opening.attributes),
	);

	const newJsxChildren = el.children.map((ch) => {
		if (ts.isJsxElement(ch)) {
			const t = getIntrinsicJsxTagName(ch.openingElement);
			if (t === "case") return transformCaseJsxElement(factory, context, ch, switchPreload);
		}
		if (ts.isJsxSelfClosingElement(ch)) {
			const t = getIntrinsicJsxTagName(ch);
			if (t === "case") return transformCaseJsxSelfClosing(factory, context, ch, switchPreload);
		}
		return deepTransformSwitchesInJsxChild(factory, context, ch, switchPreload) as ts.JsxChild;
	});

	return factory.updateJsxElement(el, newOpening, factory.createNodeArray(newJsxChildren), el.closingElement);
}

function deepTransformSwitchesInJsxChild(
	factory: ts.NodeFactory,
	context: ts.TransformationContext,
	ch: ts.JsxChild,
	_switchPreloadHint: boolean,
): ts.JsxChild {
	if (ts.isJsxElement(ch)) {
		if (getIntrinsicJsxTagName(ch.openingElement) === "switch") {
			return transformSwitchJsxElement(factory, context, ch);
		}
		return factory.updateJsxElement(
			ch,
			ch.openingElement,
			factory.createNodeArray(
				ch.children.map((c) => deepTransformSwitchesInJsxChild(factory, context, c, _switchPreloadHint)),
			),
			ch.closingElement,
		);
	}
	if (ts.isJsxFragment(ch)) {
		return factory.updateJsxFragment(
			ch,
			ch.openingFragment,
			factory.createNodeArray(
				ch.children.map((c) => deepTransformSwitchesInJsxChild(factory, context, c, _switchPreloadHint)),
			),
			ch.closingFragment,
		);
	}
	return ch;
}

function deepTransformSwitchesInExpr(
	factory: ts.NodeFactory,
	context: ts.TransformationContext,
	expr: ts.Expression,
): ts.Expression {
	const visit = (node: ts.Node): ts.Node => {
		if (ts.isCallExpression(node) && isJsxCall(node) && getJsxStringTag(node) === "switch") {
			return transformSwitchCall(factory, context, node);
		}
		if (ts.isJsxElement(node) && getIntrinsicJsxTagName(node.openingElement) === "switch") {
			return transformSwitchJsxElement(factory, context, node);
		}
		return ts.visitEachChild(node, visit, context);
	};
	return visit(expr) as ts.Expression;
}

function processSwitchChildrenExpr(
	factory: ts.NodeFactory,
	context: ts.TransformationContext,
	expr: ts.Expression,
	switchPreload: boolean,
): ts.Expression {
	if (ts.isArrayLiteralExpression(expr)) {
		const elems = expr.elements.map((el) => {
			if (ts.isCallExpression(el) && isJsxCall(el) && getJsxStringTag(el) === "case") {
				return transformCaseCall(factory, context, el, switchPreload);
			}
			return deepTransformSwitchesInExpr(factory, context, el as ts.Expression) as ts.Expression;
		});
		return factory.updateArrayLiteralExpression(expr, elems);
	}

	if (ts.isCallExpression(expr) && isJsxCall(expr) && getJsxStringTag(expr) === "case") {
		return transformCaseCall(factory, context, expr, switchPreload);
	}

	if (ts.isCallExpression(expr) && isJsxCall(expr) && isFragmentJsx(expr)) {
		const fragProps = getPropsArg(expr);
		if (fragProps && ts.isObjectLiteralExpression(fragProps) && !hasSpread(fragProps)) {
			const ch = getPropInitializer(fragProps, "children");
			if (ch) {
				const nextCh = processSwitchChildrenExpr(factory, context, ch, switchPreload);
				const newFragProps = rebuildObjectWithChildren(factory, fragProps, nextCh, false);
				return factory.updateCallExpression(expr, expr.expression, expr.typeArguments, [
					expr.arguments[0],
					newFragProps,
					...expr.arguments.slice(2),
				]);
			}
		}
	}

	return deepTransformSwitchesInExpr(factory, context, expr);
}

function transformSwitchCall(
	factory: ts.NodeFactory,
	context: ts.TransformationContext,
	ce: ts.CallExpression,
): ts.CallExpression {
	const tag = getJsxStringTag(ce);
	if (tag !== "switch") return ce;

	const propsArg = getPropsArg(ce);
	if (!propsArg || !ts.isObjectLiteralExpression(propsArg) || hasSpread(propsArg)) return ce;

	const switchPreload = isTruthyPreload(getPropInitializer(propsArg, "preload"));
	const childrenInit = getPropInitializer(propsArg, "children");
	if (!childrenInit) {
		const stripped = omitPreloadFromObject(factory, propsArg);
		return factory.updateCallExpression(ce, ce.expression, ce.typeArguments, [
			ce.arguments[0],
			stripped,
			...ce.arguments.slice(2),
		]);
	}

	const nextChildren = processSwitchChildrenExpr(factory, context, childrenInit, switchPreload);
	let newProps = rebuildObjectWithChildren(factory, propsArg, nextChildren, true);
	return factory.updateCallExpression(ce, ce.expression, ce.typeArguments, [
		ce.arguments[0],
		newProps,
		...ce.arguments.slice(2),
	]);
}

function transformerFactory(context: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
	const factory = context.factory;
	const visit: ts.Visitor = (node) => {
		if (ts.isCallExpression(node) && isJsxCall(node) && getJsxStringTag(node) === "switch") {
			return transformSwitchCall(factory, context, node);
		}
		if (ts.isJsxElement(node) && getIntrinsicJsxTagName(node.openingElement) === "switch") {
			return transformSwitchJsxElement(factory, context, node);
		}
		return ts.visitEachChild(node, visit, context);
	};
	return (sourceFile) => ts.visitNode(sourceFile, visit) as ts.SourceFile;
}

export function lazyCaseChildrenPlugin(_projectRoot: string): Plugin {
	void _projectRoot;
	return {
		name: "lazy-case-children",
		enforce: "pre",
		transform(code, id) {
			const normId = id.replace(/\\/g, "/");
			/* Solo app `client/**`, mai `core/client/**` (runtime JSX). */
			if (normId.includes("/core/client/")) return null;
			if (!normId.includes("/client/")) return null;
			if (!/\.[cm]?tsx$/.test(id)) return null;

			const sf = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
			const out = ts.transform(sf, [transformerFactory]);
			const transformed = out.transformed[0] as ts.SourceFile;
			out.dispose();

			const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false });
			const outCode = printer.printFile(transformed);
			if (outCode === code) return null;

			return { code: outCode, map: null };
		},
	};
}
