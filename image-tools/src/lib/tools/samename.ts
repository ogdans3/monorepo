/**
 * JPG and JPEG are the same format. The only difference is how many letters
 * the extension has, a leftover from MS-DOS allowing three.
 *
 * People search for this conversion constantly and every converter obliges by
 * decoding and re-encoding the picture, which quietly loses a little quality
 * to change nothing at all. These two pages exist to answer the question
 * honestly and to do the one useful thing, which is renaming the file.
 */

export interface SameNamePage {
	slug: string;
	from: string;
	to: string;
	ext: '.jpg' | '.jpeg';
	title: string;
	description: string;
	h1: string;
	lede: string;
	/** The explanation, which is most of why the page is worth visiting. */
	about: string[];
	faq: { q: string; a: string }[];
}

const SHARED_FAQ = {
	q: 'Is JPG the same as JPEG?',
	a: 'Yes, exactly the same. JPEG is the name of the format, after the Joint Photographic Experts Group that designed it. JPG is the same word cut to three letters, because early versions of Windows and MS-DOS couldn\'t handle a longer extension. Any program that opens one opens the other, and the bytes inside the file are identical.'
};

export const SAME_NAME_PAGES: SameNamePage[] = [
	{
		slug: 'jpeg-to-jpg',
		from: 'JPEG',
		to: 'JPG',
		ext: '.jpg',
		title: 'JPEG to JPG - Free Converter, No Quality Loss',
		description:
			'Convert JPEG to JPG online free. They are the same format, so your file is renamed rather than re-encoded and no quality is lost. Runs in your browser.',
		h1: 'Convert JPEG to JPG',
		lede: 'JPEG and JPG are the same format, so nothing has to be re-saved. Your file is renamed, byte for byte, and comes back as .jpg.',
		about: [
			'If something has asked you for a JPG and you have a JPEG, you already have the right file. The extension is the only difference, and renaming it is enough. That\'s what this page does.',
			'Most converters re-encode the picture anyway, which means decoding it and saving it again. A JPEG loses a little detail every time it is saved, so that\'s a real cost for no benefit at all. Here the bytes come back untouched.',
			'The one case that does need converting is a file that\'s not really a JPEG. Saving a PNG as photo.jpeg is common, and some programs will reject it precisely because the contents don\'t match the name. The bytes are checked here, and anything that turns out to be a different format is converted properly, with the row saying so.'
		],
		faq: [
			SHARED_FAQ,
			{
				q: 'Will I lose quality converting JPEG to JPG?',
				a: 'Not here, because nothing is re-saved. The file you download is the same bytes you dropped in with a different extension on the name. Tools that genuinely re-encode the image do cost you a little detail, since JPEG throws some away every time it saves, which is a strange price to pay for a change of spelling.'
			},
			{
				q: 'Why does the form only accept .jpg then?',
				a: 'Usually because someone wrote the list of allowed extensions by hand and forgot the four letter spelling. The file itself is fine, and renaming it is enough to get past the check. It\'s worth knowing that this is a quirk of the form rather than anything to do with your picture.'
			}
		]
	},
	{
		slug: 'jpg-to-jpeg',
		from: 'JPG',
		to: 'JPEG',
		ext: '.jpeg',
		title: 'JPG to JPEG - Free Converter, No Quality Loss',
		description:
			'Convert JPG to JPEG online free. Same format, so the file is renamed rather than re-encoded and nothing is lost. Free, in your browser, no uploads.',
		h1: 'Convert JPG to JPEG',
		lede: 'JPG and JPEG are the same format. Your file is renamed, byte for byte, and comes back with the .jpeg extension.',
		about: [
			'Some systems insist on the four letter spelling, usually because whoever wrote the upload check only listed one of the two. Your file is already correct, so all it needs is the other extension, and that\'s what you get here.',
			'Nothing is decoded or saved again along the way. That matters because a JPEG loses a little detail every time it is re-encoded, and there\'s no reason to pay that for a change of spelling.',
			'Files that only claim to be JPG are handled properly. If the bytes turn out to be a PNG or something else wearing the wrong extension, it\'s converted for real and the row tells you what it actually was.'
		],
		faq: [
			SHARED_FAQ,
			{
				q: 'Which spelling should I use, .jpg or .jpeg?',
				a: 'Whichever the thing you\'re feeding it to asks for. Neither is more correct, and both have been understood everywhere for decades. If nobody has told you, .jpg is the more common of the two by a wide margin, which makes it the safer default for a file you\'re going to share.'
			},
			{
				q: 'Does renaming a file change what is inside it?',
				a: 'No. The extension is part of the name, not part of the contents, so the picture data is identical either way. It matters only because programs use the extension as a first guess at what a file is. That\'s also why renaming a PNG to .jpg doesn\'t make it a JPEG, and why the bytes are checked here rather than the name.'
			}
		]
	}
];

export function sameNameBySlug(slug: string): SameNamePage | undefined {
	return SAME_NAME_PAGES.find((p) => p.slug === slug);
}
