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
  gateLine: 'Ten pieces. None of them will come off on their own.',
}

/** Prices are stored as numbers and formatted once, here. */
export const price = (amount, currency = 'EUR') =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
