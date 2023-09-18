export function stripBom(str: string) {
	// Catches EFBBBF (UTF-8 BOM) because the buffer-to-string
	// conversion translates it to FEFF (UTF-16 BOM).
	if (str.charCodeAt(0) === 0xFEFF) {
		return str.slice(1);
	}

	return str;
}