/**
 * The house.
 *
 * Everything the brand is called lives here, so renaming it is one edit rather
 * than a search. The mark itself is drawn in `Wordmark.jsx` — deliberately the
 * same ring the whole site is built on, because the thing you drag and the
 * thing on the label ought to be the same object.
 *
 * ONDINE: the water spirit who takes human form for a lover. It suits a house
 * whose shop window fogs over, and it sets well in six letters with wide
 * tracking. Check it for trademark before it goes near a domain.
 */
export const BRAND = {
  name: 'Ondine',
  /** How the wordmark is set: letterspaced, uppercase, thin. */
  wordmark: 'ONDINE',
  house: 'Maison Ondine',
  collection: 'Première',
  season: 'Collection Première · Exclusive',
  /** Where a person writes to a house that has no shop yet. */
  email: 'atelier@maisonondine.com',
  /*
   * Where the newsletter form posts.
   *
   * Empty on purpose: there is no back end here, and a subscribe box that
   * swallows an address and says thank you is worse than none at all. While
   * this is empty the form opens the visitor's mail client instead, which
   * loses nobody. Paste a Buttondown, Formspree, Mailchimp or Kit endpoint in
   * and it becomes an ordinary POST — nothing else has to change.
   */
  newsletter: '',
}

/**
 * The copy says how many pieces there are, so it is counted rather than
 * written down. It said ten for a while after there were seven.
 */
const WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
]
export const spell = (n) => WORDS[n] ?? String(n)
export const Spell = (n) => {
  const w = spell(n)
  return w.charAt(0).toUpperCase() + w.slice(1)
}

/** Prices are stored as numbers and formatted once, here. */
export const price = (amount, currency = 'EUR') =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
