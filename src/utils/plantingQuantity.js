export function plantedFromLeftover(distributed, leftover) {
  return Math.max(0, Number(distributed || 0) - Number(leftover || 0));
}

export function leftoverQuantityError(leftover, distributed) {
  const text = String(leftover ?? "").trim();
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text))) return "Enter a nonnegative whole number.";
  if (Number(text) > Number(distributed)) return `Leftover cannot exceed the ${Number(distributed)} seedlings available.`;
  return "";
}
