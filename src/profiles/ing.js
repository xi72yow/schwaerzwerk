// column positions as a fraction of the page width, taken from the point
// values that worked on A4 statements (595pt wide)
export default {
  id: "ing",
  label: "ING Girokonto",
  groupBookings: true,
  amountColumn: 0.84,
  addressColumn: 0.5,
  leftMargin: 0.067,
  headerTerms: ["saldo", "kontoüberziehung", "kontoueberziehung"],
  detect: (text) => /\bING(?:-DiBa)?\b/i.test(text) && /kontoauszug|girokonto/i.test(text),
};
