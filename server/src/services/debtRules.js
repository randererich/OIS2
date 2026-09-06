export function cashOperationFor(categoryName, productName) {
  if (!["Sularaha", "REPART", "🪙 REPART 🪙"].includes(categoryName)) {
    return null;
  }

  const normalizedName = String(productName || "").toLowerCase();
  if (normalizedName === "sissemakse") {
    return "cash_deposit";
  }
  if (normalizedName === "väljamakse" || normalizedName === "valjamakse") {
    return "cash_withdrawal";
  }
  return null;
}

export function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function purchaseDebtEffect({ product, quantity, paidWithCash = false }) {
  const cashOperation = product.cash_operation || cashOperationFor(product.category_name, product.name);
  const parsedQuantity = Number(quantity);

  if (cashOperation) {
    const cashUnitPrice = Math.abs(Number(product.price)) || 1;
    const total = roundMoney(cashUnitPrice * Math.abs(parsedQuantity));
    return cashOperation === "cash_deposit" ? -total : total;
  }

  if (paidWithCash) {
    return 0;
  }

  return roundMoney(Number(product.price) * parsedQuantity);
}

export function wouldCreateDisallowedDebt({ currentDebt, debtEffect }) {
  const roundedEffect = roundMoney(debtEffect);
  return roundedEffect > 0 && roundMoney(Number(currentDebt || 0) + roundedEffect) > 0;
}
