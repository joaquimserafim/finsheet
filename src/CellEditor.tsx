/**
 * finsheet — the cell editor input (Epic 5). An UNCONTROLLED `<input>`: the draft
 * lives in the DOM, never in React state, so a keystroke re-renders nothing. Only
 * the committed value round-trips through the consumer's `onEdit` → fresh `model`.
 *
 * It self-focuses on mount and owns the editing-phase keys (Enter/Tab commit-and-
 * move, Escape cancel), stopping their propagation so the container's keydown never
 * re-reads them; caret keys and printable chars are left to bubble (the container
 * early-returns while editing). Focus loss finalises via `blurActive`.
 */

import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef } from "react";
import { classifyKey, ignoreDuringComposition, modifierHeld } from "./editing";
import type { GridEditing } from "./useGridEditing";

interface CellEditorProps {
	editing: GridEditing;
	/** Seed text: the char that opened the editor, or the raw stored value. */
	initialValue: string;
	/** Whether the last commit attempt was rejected (drives styling + `aria-invalid`). */
	invalid: boolean;
	/** Accessible name, e.g. "Product, Actual". */
	ariaLabel: string;
}

export function CellEditor({ editing, initialValue, invalid, ariaLabel }: CellEditorProps) {
	const { editSeedRef } = editing;
	const inputRef = useRef<HTMLInputElement>(null);
	// Once a keyboard commit/cancel has finalised (and is about to unmount us), the
	// trailing native blur must be ignored so it can't commit a second time.
	const committedRef = useRef(false);

	// Focus on mount, then set the selection by HOW the editor was opened:
	//  - no seed (F2 / Enter / double-click): select all, so typing replaces the value;
	//  - opened by a typed char (seed): collapse the caret to the end, so the seed is
	//    kept and the next keystrokes append (otherwise select() would clobber the seed).
	useEffect(() => {
		// biome-ignore lint/style/noNonNullAssertion: the input is always mounted in its own mount effect.
		const input = inputRef.current!;
		input.focus();
		if (editSeedRef.current === null) {
			input.select();
		} else {
			const end = input.value.length;
			input.setSelectionRange(end, end);
		}
	}, [editSeedRef]);

	// A teardown that is NOT a keyboard commit/cancel (a parent unmounting the editor
	// via a model or mode change) must not let the trailing native blur commit a stale
	// draft against a torn-down model — arm the guard on unmount.
	useEffect(
		() => () => {
			committedRef.current = true;
		},
		[],
	);

	// The editor is mounted whenever a handler reads the draft, so the ref is set.
	// biome-ignore lint/style/noNonNullAssertion: draft() only runs from this input's own key/blur handlers.
	const draft = () => inputRef.current!.value;

	function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
		if (ignoreDuringComposition(e.key, e.nativeEvent.isComposing)) {
			return; // an IME is composing: Enter/Tab pick a candidate, they don't commit
		}
		const mod = modifierHeld(e.ctrlKey, e.metaKey, e.altKey);
		const intent = classifyKey(e.key, e.shiftKey, mod, true);
		if (intent.kind === "commitMove") {
			e.preventDefault();
			e.stopPropagation(); // the container keydown must not also act on this key
			if (editing.commitActive(draft(), intent.dir)) {
				committedRef.current = true; // a valid commit unmounts us; guard the blur
			}
			return;
		}
		if (intent.kind === "cancel") {
			e.preventDefault();
			e.stopPropagation();
			committedRef.current = true; // cancel also unmounts us
			editing.cancelActive();
			return;
		}
		// "none": caret / printable keys — leave them to the input, and let the event
		// bubble so the container's keydown early-returns while editing.
	}

	function onBlur() {
		// A keyboard commit/cancel already finalised (and unmounted) this editor; the
		// trailing native blur then fires only in a REAL browser — happy-dom does not
		// emit it. Grid.browser.test.tsx asserts this guard live in Chromium; the ignore
		// stays because the happy-dom coverage run (the 100% gate) can never reach the line.
		/* v8 ignore start */
		if (committedRef.current) {
			return;
		}
		/* v8 ignore stop */
		editing.blurActive(draft());
	}

	return (
		<input
			ref={inputRef}
			className={invalid ? "finsheet-cell-input is-invalid" : "finsheet-cell-input"}
			defaultValue={initialValue}
			aria-label={ariaLabel}
			aria-invalid={invalid || undefined}
			inputMode="decimal"
			autoComplete="off"
			spellCheck={false}
			onKeyDown={onKeyDown}
			onBlur={onBlur}
		/>
	);
}
