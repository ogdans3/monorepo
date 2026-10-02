import { expect, test } from '@playwright/test';

const password = process.env.PODIUM_PASSWORD;

test('a question goes up, a phone votes, and the screen counts it', async ({ browser }) => {
	test.skip(!password, 'PODIUM_PASSWORD is the admin password of the Podium under test');

	const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const editor = await desk.newPage();
	const problems: string[] = [];
	editor.on('pageerror', (e) => problems.push(e.message));

	await editor.goto('/admin');
	await editor.getByLabel('Passord').fill(password!);
	await editor.getByRole('button', { name: 'Logg inn' }).click();
	await editor.getByRole('button', { name: 'Ny presentasjon' }).click();
	const title = `Ende til ende ${Date.now()}`;
	await editor.getByLabel('Tittel').fill(title);
	await editor.getByRole('button', { name: 'Lag presentasjonen' }).click();
	await editor.waitForURL(/\/admin\/[0-9a-f-]{36}$/);
	const id = editor.url().split('/').pop()!;

	try {
		// A question after the way in, with an answer renamed on its inspector.
		await editor.getByRole('button', { name: 'Spørsmål', exact: true }).click();
		await expect(editor.locator('.thumb')).toHaveCount(2);
		await editor.locator('.hit[aria-label="Svar: Ja"]').click();
		await editor.getByLabel('Svaret', { exact: true }).fill('Absolutt');
		await expect(editor.getByText('Lagret', { exact: true })).toBeVisible();

		// Start opens the display on the first slide: the title and the code, big.
		const [display] = await Promise.all([
			editor.waitForEvent('popup'),
			editor.getByRole('button', { name: 'Start' }).click()
		]);
		display.on('pageerror', (e) => problems.push(e.message));
		await expect(display.getByText(title)).toBeVisible();
		await expect(display.getByRole('img', { name: 'QR-kode til stemmesiden' })).toBeVisible();

		// A phone on the ballot waits, empty, until a question is up.
		const code = (await editor.locator('.code b').textContent())!.trim();
		const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
		const ballot = await phone.newPage();
		ballot.on('pageerror', (e) => problems.push(e.message));
		await ballot.goto(`/stem/${code.toLowerCase()}`);
		await expect(ballot.getByText('Venter på neste spørsmål')).toBeVisible();

		// The question goes up, and the phone has it at once, as coloured tiles.
		const shown = Date.now();
		await editor.getByRole('button', { name: 'Neste side' }).click();
		const absolutt = ballot.getByRole('button', { name: 'A: Absolutt' });
		await expect(absolutt).toBeVisible();
		expect(Date.now() - shown).toBeLessThan(3000);
		const answers = display.locator('[data-type="option"]');
		await expect(answers).toHaveCount(2);
		await expect(answers.first()).toContainText('Absolutt');

		// The phone votes once, and the screen counts it where the answer is.
		await absolutt.tap();
		await expect(ballot.getByText('Stemt')).toBeVisible();
		await expect(ballot.getByRole('button', { name: 'B: Nei' })).toBeDisabled();
		await expect(answers.first().locator('.visually-hidden')).toHaveText('1');
		await expect(answers.first()).toContainText('100 %');
		await expect(editor.locator('.thumb').nth(1).locator('..')).toContainText('1 stemme');

		// The presenter moves on, and the phone follows without being touched.
		await editor.getByRole('button', { name: 'Forrige side' }).click();
		await expect(ballot.getByText('Venter på neste spørsmål')).toBeVisible();
		await expect(display.getByText(title)).toBeVisible();

		// Back to the question: the phone remembers it has answered.
		await editor.getByRole('button', { name: 'Neste side' }).click();
		await expect(ballot.getByText('Stemt')).toBeVisible();
		await phone.close();
	} finally {
		await editor.request.delete(`/api/admin/presentations/${id}`);
		await desk.close();
	}
	expect(problems).toEqual([]);
});
