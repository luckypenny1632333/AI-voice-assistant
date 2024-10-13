/**
 * Get the language code (BCP 47 language tag) based on the country code (ISO 3166-1 alpha-2 country codes).
 * A full BCP 47 language tag example:
 * - en-US (English as used in the United States)
 * - fr-FR (French as used in France)
 */
export const getLanguageByCountryCode = (countryCode: string): string => {
  switch (countryCode.toUpperCase()) {
    case 'US':
      return 'en-US';
    case 'CA':
      return 'en-CA'; // Canada
    case 'GB':
      return 'en-GB'; // United Kingdom
    case 'AU':
      return 'en-AU'; // Australia
    case 'IN':
      return 'hi-IN'; // India (could also be 'en-IN')
    case 'DE':
      return 'de-DE'; // Germany
    case 'FR':
      return 'fr-FR'; // France
    case 'ES':
      return 'es-ES'; // Spain
    case 'IT':
      return 'it-IT'; // Italy
    case 'RU':
      return 'ru-RU'; // Russia
    case 'CN':
      return 'zh-CN'; // China
    case 'JP':
      return 'ja-JP'; // Japan
    case 'BR':
      return 'pt-BR'; // Brazil
    case 'MX':
      return 'es-MX'; // Mexico
    case 'ZA':
      return 'en-ZA'; // South Africa
    case 'NG':
      return 'en-NG'; // Nigeria
    case 'AR':
      return 'es-AR'; // Argentina
    case 'CL':
      return 'es-CL'; // Chile
    case 'CO':
      return 'es-CO'; // Colombia
    case 'PE':
      return 'es-PE'; // Peru
    case 'KR':
      return 'ko-KR'; // South Korea
    case 'SE':
      return 'sv-SE'; // Sweden
    case 'FI':
      return 'fi-FI'; // Finland
    case 'NO':
      return 'no-NO'; // Norway
    case 'DK':
      return 'da-DK'; // Denmark
    case 'NL':
      return 'nl-NL'; // Netherlands
    case 'BE':
      return 'fr-BE'; // Belgium (could also be 'nl-BE')
    case 'CH':
      return 'de-CH'; // Switzerland (could also be 'fr-CH', 'it-CH', 'rm-CH')
    case 'AT':
      return 'de-AT'; // Austria
    case 'PL':
      return 'pl-PL'; // Poland
    case 'CZ':
      return 'cs-CZ'; // Czech Republic
    case 'HU':
      return 'hu-HU'; // Hungary
    case 'GR':
      return 'el-GR'; // Greece
    case 'PT':
      return 'pt-PT'; // Portugal
    case 'TR':
      return 'tr-TR'; // Turkey
    case 'EG':
      return 'ar-EG'; // Egypt
    case 'SA':
      return 'ar-SA'; // Saudi Arabia
    case 'AE':
      return 'ar-AE'; // United Arab Emirates
    case 'TH':
      return 'th-TH'; // Thailand
    case 'VN':
      return 'vi-VN'; // Vietnam
    case 'PH':
      return 'en-PH'; // Philippines (could also be 'tl-PH')
    case 'ID':
      return 'id-ID'; // Indonesia
    case 'MY':
      return 'ms-MY'; // Malaysia
    case 'SG':
      return 'en-SG'; // Singapore
    case 'NZ':
      return 'en-NZ'; // New Zealand
    case 'KE':
      return 'en-KE'; // Kenya
    case 'TZ':
      return 'sw-TZ'; // Tanzania
    case 'RW':
      return 'rw-RW'; // Rwanda
    case 'ET':
      return 'am-ET'; // Ethiopia
    case 'NG':
      return 'en-NG'; // Nigeria
    case 'PK':
      return 'ur-PK'; // Pakistan
    default:
      return 'en-US'; // Default if country code is not found
  }
};
