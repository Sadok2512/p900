export type ConditionTone = "fail" | "success" | "nr" | "lte" | "procedure" | "interface" | "cause" | "other";

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

/** Colour category of a query condition, from its structured field and value. */
export function conditionTone(field: unknown, value: unknown): ConditionTone {
  const f = norm(field), v = norm(value);
  if (f === "résultat" || f === "resultat" || f === "result") {
    if (/^(échec|echec|failure|fail)$/.test(v)) return "fail";
    if (/^(succès|succes|success)$/.test(v)) return "success";
    return "other";
  }
  if (f === "rat") {
    if (/5g|nr/.test(v)) return "nr";
    if (/lte|4g/.test(v)) return "lte";
    return "other";
  }
  if (f === "procédure" || f === "procedure") return "procedure";
  if (f === "interface") return "interface";
  if (f === "cause") return "cause";
  return "other";
}
