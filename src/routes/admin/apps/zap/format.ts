export function formatMoney(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const pennies = abs % 100;
  return `${neg ? "-" : ""}$${dollars}.${pennies.toString().padStart(2, "0")}`;
}

export function balanceLabel(cents: number): string {
  if (cents === 0) return "All settled";
  if (cents > 0) return `You are owed ${formatMoney(cents)}`;
  return `You owe ${formatMoney(-cents)}`;
}
