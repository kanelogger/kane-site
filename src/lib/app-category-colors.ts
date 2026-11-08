// Interleave warm and cool hues so neighboring categories are easy to scan.
const categoryHues = [165, 320, 110, 275, 70, 230, 25, 190, 345, 140, 300, 90, 250, 45, 210, 5];

export function appCategoryHue(index: number): string {
  return String(categoryHues[index % categoryHues.length]);
}
