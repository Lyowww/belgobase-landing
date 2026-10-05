// Public Google Ads identifiers, verified in the BelgoBase account on 2026-09-28.
// These are not credentials. Campaigns and advertising budgets are managed separately.
// An explicit empty NEXT_PUBLIC_GOOGLE_ADS_ID disables the website measurement.
export const PUBLIC_GOOGLE_ADS_ID = "AW-828167396";
export const PUBLIC_GOOGLE_ADS_CONVERSION_LABEL = "XPY8CP6Gj4kdEOSp84oD";

// Public Measurement ID for the separate BelgoBase GA4 web stream, supplied on
// 2026-10-05. This is not a credential. An empty value remains the GA4 kill switch.
export const PUBLIC_GA4_MEASUREMENT_ID = "G-Q1NX0JS1G8";

// Explicitly enabled for the 2026-10-05 Ads + GA4 candidate after the real GA4
// Measurement ID was supplied. Set false for a complete local kill switch.
export const PUBLIC_MARKETING_MEASUREMENT_ENABLED = true;
