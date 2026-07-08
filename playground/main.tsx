import { VERSION } from "columnar";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) {
	throw new Error("missing #root element");
}

createRoot(root).render(
	<StrictMode>
		<main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
			<h1>columnar playground</h1>
			<p>library version: {VERSION}</p>
		</main>
	</StrictMode>,
);
