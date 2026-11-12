import { describe, it, expect } from "vitest";
import { conditionTone } from "./conditionTone";
describe("conditionTone", () => {
  it("Résultat = Échec is red", () => expect(conditionTone("Résultat", "Échec")).toBe("fail"));
  it("Résultat = Succès is green", () => expect(conditionTone("Résultat", "Succès")).toBe("success"));
  it("Résultat = Unknown is neutral", () => expect(conditionTone("Résultat", "Unknown")).toBe("other"));
  it("RAT 5G SA is blue, LTE is green", () => { expect(conditionTone("RAT", "5G SA")).toBe("nr"); expect(conditionTone("RAT", "LTE")).toBe("lte"); });
  it("Procedure, Interface, Cause categories", () => {
    expect(conditionTone("Procédure", "PDU Session")).toBe("procedure");
    expect(conditionTone("Interface", "N4")).toBe("interface");
    expect(conditionTone("Cause", "S6a 5001")).toBe("cause");
  });
  it("value text alone never sets the category", () => expect(conditionTone("Capture", "Échec")).toBe("other"));
});
