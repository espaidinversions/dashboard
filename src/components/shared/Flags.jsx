
// EN maps to GB (United Kingdom ISO code)
const GEO_TO_ISO = { EN:"gb" };

const twemojiCache = new Map();
const twemojiUrl = (isoCode) => {
  if (twemojiCache.has(isoCode)) return twemojiCache.get(isoCode);
  const upper = (GEO_TO_ISO[isoCode] || isoCode).toUpperCase();
  const base = 0x1F1E6 - 65; // 65 = 'A'.charCodeAt(0)
  const cp1 = (upper.charCodeAt(0) + base).toString(16);
  const cp2 = (upper.charCodeAt(1) + base).toString(16);
  const url = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${cp1}-${cp2}.svg`;
  twemojiCache.set(isoCode, url);
  return url;
};

export const FlagImg = ({ geo, size=22 }) => {
  if (!geo) return null;
  return (
    <img
      src={twemojiUrl(geo)}
      alt={geo}
      style={{ width:size, height:size, verticalAlign:"middle" }}
    />
  );
};
