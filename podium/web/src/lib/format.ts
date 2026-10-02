// Numbers and dates the Norwegian way: 1 248, 59 %, 2. okt.

const whole = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });

export function count(n: number): string {
	return whole.format(n);
}

/** An option's share of the votes, rounded, as «59 %». */
export function share(n: number, total: number): string {
	return `${total > 0 ? Math.round((n / total) * 100) : 0} %`;
}

export function votes(n: number): string {
	return n === 1 ? '1 stemme' : `${count(n)} stemmer`;
}

export function bytes(n: number): string {
	if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} kB`;
	if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',')} MB`;
	return `${(n / 1024 / 1024 / 1024).toFixed(1).replace('.', ',')} GB`;
}

const day = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short' });
const time = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit' });

/** When something last changed, as near as is useful: «i dag 14:05», «2. okt.». */
export function changed(iso: string, now = new Date()): string {
	const d = new Date(iso);
	const sameDay = d.toDateString() === now.toDateString();
	if (sameDay) return `i dag ${time.format(d)}`;
	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	if (d.toDateString() === yesterday.toDateString()) return `i går ${time.format(d)}`;
	const label = day.format(d);
	return d.getFullYear() === now.getFullYear() ? label : `${label} ${d.getFullYear()}`;
}
