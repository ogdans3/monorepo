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

		// «Svar» pressed twice is two more answers, each of its own.
		await editor.getByRole('button', { name: 'Svar', exact: true }).click();
		await editor.getByRole('button', { name: 'Svar', exact: true }).click();
		await expect(editor.locator('.canvas [data-type="option"]')).toHaveCount(4);
		await expect(editor.locator('.hit[aria-label="Svar: Svar 4"]')).toHaveCount(1);
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
		await expect(answers).toHaveCount(4);
		await expect(ballot.locator('.tile')).toHaveCount(4);
		await expect(ballot.getByRole('button', { name: 'D: Svar 4' })).toBeVisible();
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

		// Started again with votes in it, the presentation asks first; starting
		// at nothing lets the phone vote again, and the screen counts from zero.
		await editor.getByRole('button', { name: 'Avslutt' }).click();
		await expect(display.getByText('Presentasjonen er over. Takk!')).toBeVisible();
		await editor.getByRole('button', { name: 'Start' }).click();
		const dialog = editor.getByRole('dialog', { name: 'Nullstille stemmene før du starter?' });
		await expect(dialog).toContainText('1 stemme');
		await dialog.getByRole('button', { name: 'Nullstill og start' }).click();
		await expect(dialog).toBeHidden();
		await expect(display.getByText(title)).toBeVisible();
		await editor.getByRole('button', { name: 'Neste side' }).click();
		await expect(answers.first().locator('.visually-hidden')).toHaveText('0');
		await expect(absolutt).toBeEnabled();
		await expect(ballot.getByText('Stemt')).toBeHidden();

		// And from the editor, any time: the button for every vote at once.
		await absolutt.tap();
		await expect(answers.first().locator('.visually-hidden')).toHaveText('1');
		await editor.locator('.thumb').nth(1).click();
		editor.once('dialog', (d) => d.accept());
		await editor.getByRole('button', { name: 'Nullstill alle stemmer' }).click();
		await expect(answers.first().locator('.visually-hidden')).toHaveText('0');
		await expect(absolutt).toBeEnabled();
		await phone.close();
	} finally {
		await editor.request.delete(`/api/admin/presentations/${id}`);
		await desk.close();
	}
	expect(problems).toEqual([]);
});
