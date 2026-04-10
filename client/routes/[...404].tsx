import { Fragment } from "../../core/client/runtime";

export default function NotFound() {
	return (
		<Fragment>
			<h1 s="fw-title">404</h1>
			<p>Pagina non trovata.</p>
			<p>
				<a href="/">Torna alla home</a>
			</p>
		</Fragment>
	);
}
