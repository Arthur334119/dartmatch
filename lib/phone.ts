// Telefonnummer-Validierung über libphonenumber-js (Googles offizielle
// Library als JS-Port). Wir verifizieren NICHT, ob die Nummer tatsächlich
// dem User gehört (kein SMS-OTP) — nur, dass es eine syntaktisch valide
// Nummer mit existierender Vorwahl + plausibler Länge ist.

import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

export type PhoneValidation =
  | { valid: true; e164: string; country: CountryCode | undefined }
  | { valid: false; reason: string };

/**
 * Prüft ob `raw` eine plausible Telefonnummer ist und liefert die
 * normalisierte E.164-Form zurück (z. B. „+491701234567").
 *
 * `defaultCountry` greift nur, wenn der User die Nummer ohne Ländervorwahl
 * eingibt (z. B. „01701234567" → wird mit DE als +491701234567 interpretiert).
 */
export function validatePhone(
  raw: string,
  defaultCountry: CountryCode = 'DE',
): PhoneValidation {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, reason: 'Bitte eine Telefonnummer eingeben.' };
  }

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed) {
    return {
      valid: false,
      reason: 'Ungültige Telefonnummer. Bitte mit Vorwahl eingeben (z. B. +49 170 1234567).',
    };
  }

  if (!parsed.isValid()) {
    return {
      valid: false,
      reason: 'Diese Telefonnummer existiert nicht. Bitte Vorwahl und Länge prüfen.',
    };
  }

  return {
    valid: true,
    e164: parsed.number,
    country: parsed.country,
  };
}
