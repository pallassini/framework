/** Entry app: JSX automatico usa `jsx-runtime/*` via tsconfig; qui solo ciò che importi esplicitamente. */
export { Fragment, jsx, jsxDEV, jsxs } from "./logic/jsx-runtime";
export { registerIcon } from "./tag/tags/icon/index";
export {
	disposeNodeTree,
	onNodeDispose,
	replaceChildrenWithDispose,
} from "./logic/lifecycle";
