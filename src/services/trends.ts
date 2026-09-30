/**
 * Google Trends Helper (Module K)
 */
export function openGoogleTrends(keyword: string): void {
  const url = `https://trends.google.com/trends/explore?q=${encodeURIComponent(
    keyword
  )}&geo=US`;
  window.open(url, '_blank');
}
