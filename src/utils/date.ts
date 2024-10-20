export const getNowAsLocaleString = (
  locales: Intl.LocalesArgument = 'de-DE',
  timeZone = 'Europe/Berlin'
) => {
  return new Date().toLocaleString(locales, { timeZone });
};
