export const isJSON = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

export const formatJSON = (str: string): string => {
  return isJSON(str) ? JSON.stringify(JSON.parse(str), null, 2) : str;
};
