import { z } from 'zod'

/**
 * What the API says when a request does not fit its schema.
 *
 * Zod writes its own messages, and they are English and about types:
 * «Expected string, received null» reached a person on screen 06h, in a black
 * bar under the button they had just pressed. Nothing in the product speaks
 * English to anybody, and a validation failure is not the one exception.
 *
 * A *global* map is the right place for it rather than a message per field.
 * Zod resolves an issue's text in order — a message written into the schema
 * wins over this one — so `z.string().min(8, 'Passordet må ha minst 8 tegn.')`
 * still says exactly that, and everything without copy of its own falls back
 * here instead of to English.
 *
 * These are deliberately short and free of field names. The good message for a
 * rule the product has is thrown by the route that knows the rule; this is what
 * is left when a request is simply malformed, which is usually a bug in a
 * client rather than something a person did.
 */
export const norwegianIssues: z.ZodErrorMap = (issue) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return {
        message:
          issue.received === z.ZodParsedType.undefined || issue.received === z.ZodParsedType.null
            ? 'Noe mangler i det du sendte.'
            : 'Noe i det du sendte har feil format.',
      }

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'Skriv en gyldig e-postadresse.' }
      if (issue.validation === 'uuid') return { message: 'Ugyldig referanse.' }
      if (issue.validation === 'url') return { message: 'Skriv en gyldig lenke.' }
      return { message: 'Formatet stemmer ikke.' }

    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return {
          message:
            issue.minimum === 1
              ? 'Dette feltet kan ikke være tomt.'
              : `Skriv minst ${issue.minimum} tegn.`,
        }
      }
      if (issue.type === 'array') return { message: `Velg minst ${issue.minimum}.` }
      return { message: `Tallet må være minst ${issue.minimum}.` }

    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `Bruk høyst ${issue.maximum} tegn.` }
      if (issue.type === 'array') return { message: `Velg høyst ${issue.maximum}.` }
      return { message: `Tallet kan være høyst ${issue.maximum}.` }

    case z.ZodIssueCode.invalid_enum_value:
    case z.ZodIssueCode.invalid_union_discriminator:
    case z.ZodIssueCode.invalid_literal:
      return { message: 'Velg et av alternativene.' }

    case z.ZodIssueCode.unrecognized_keys:
      return { message: 'Forespørselen hadde felter vi ikke kjenner igjen.' }

    case z.ZodIssueCode.invalid_date:
      return { message: 'Ugyldig dato.' }

    case z.ZodIssueCode.not_multiple_of:
    case z.ZodIssueCode.not_finite:
      return { message: 'Ugyldig tall.' }

    default:
      return { message: 'Forespørselen var ikke gyldig.' }
  }
}

/**
 * Installed once, from `buildApp`, so that a test and a deployment answer the
 * same way — and so the admin CLI, which parses nothing over HTTP, does not
 * have to remember to do it.
 */
export function speakNorwegian() {
  z.setErrorMap(norwegianIssues)
}
