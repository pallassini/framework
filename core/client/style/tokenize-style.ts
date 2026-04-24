/** Token con spazi; `mob|tab|des:(…)`, `hover:(…)`, `focus:(…)` e `bg-gradient(…)` con parentesi bilanciate. */
export function tokenizeStyleString(input: string): string[] {
	const s = input.trim();
	const out: string[] = [];
	let i = 0;
	while (i < s.length) {
		while (i < s.length && /\s/.test(s[i]!)) i++;
		if (i >= s.length) break;
		const slice = s.slice(i);
		const m = slice.match(/^(mob|tab|des):/);
		if (m) {
			const openIdx = i + m[0]!.length;
			if (s[openIdx] !== "(") {
				let j = i;
				while (j < s.length && !/\s/.test(s[j]!)) j++;
				out.push(s.slice(i, j));
				i = j;
				continue;
			}
			let depth = 1;
			let j = openIdx + 1;
			while (j < s.length && depth > 0) {
				const ch = s[j]!;
				if (ch === "(") depth++;
				else if (ch === ")") depth--;
				j++;
			}
			out.push(s.slice(i, j));
			i = j;
		} else if (/^hover:\(/i.test(slice)) {
			const openIdx = i + 6;
			if (s[openIdx] !== "(") {
				let j = i;
				while (j < s.length && !/\s/.test(s[j]!)) j++;
				out.push(s.slice(i, j));
				i = j;
				continue;
			}
			let depth = 1;
			let j = openIdx + 1;
			while (j < s.length && depth > 0) {
				const ch = s[j]!;
				if (ch === "(") depth++;
				else if (ch === ")") depth--;
				j++;
			}
			out.push(s.slice(i, j));
			i = j;
		} else if (/^focus:\(/i.test(slice)) {
			const openIdx = i + 6;
			if (s[openIdx] !== "(") {
				let j = i;
				while (j < s.length && !/\s/.test(s[j]!)) j++;
				out.push(s.slice(i, j));
				i = j;
				continue;
			}
			let depth = 1;
			let j = openIdx + 1;
			while (j < s.length && depth > 0) {
				const ch = s[j]!;
				if (ch === "(") depth++;
				else if (ch === ")") depth--;
				j++;
			}
			out.push(s.slice(i, j));
			i = j;
		} else if (/^bg-gradient\(/i.test(slice)) {
			let depth = 0;
			let j = i;
			while (j < s.length) {
				const ch = s[j]!;
				if (ch === "(") depth++;
				else if (ch === ")") {
					depth--;
					j++;
					if (depth === 0) break;
					continue;
				}
				j++;
			}
			out.push(s.slice(i, j));
			i = j;
		} else {
			let j = i;
			while (j < s.length && !/\s/.test(s[j]!)) j++;
			out.push(s.slice(i, j));
			i = j;
		}
	}
	return out;
}
