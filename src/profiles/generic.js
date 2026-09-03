// fallback for documents without a matching profile: every text line becomes a
// region of its own, no booking detection, no header rules
export default {
  id: "generic",
  label: "Beliebiges PDF, zeilenweise",
  groupBookings: false,
  amountColumn: 0.84,
  addressColumn: 0.5,
  leftMargin: 0,
  headerTerms: [],
  detect: () => false,
};
