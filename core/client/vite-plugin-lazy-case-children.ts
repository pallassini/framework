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

function deepTransformSwitchesInExpr(
	factory: ts.NodeFactory,
	context: ts.TransformationContext,
	expr: ts.Expression,
): ts.Expression {
	const visit = (node: ts.Node): ts.Node => {
		if (ts.isCallExpression(node) && isJsxCall(node) && getJsxStringTag(node) === "switch") {
			return transformSwitchCall(factory, context, node);
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
