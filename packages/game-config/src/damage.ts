/**
 * Damage formula constants (spec §4.2).
 *
 *   DanoBruto = DanoBaseDaArma + (AtributoDaArma × EscalaDaArma)
 *   Redução%  = Defesa / (Defesa + DEFENSE_CONSTANT)
 *   DanoFinal = DanoBruto × (1 − Redução%)
 *
 * The reduction curve has natural diminishing returns and never reaches 100%.
 * Reference: 60 def ≈ 33%, 120 def = 50%, 240 def ≈ 67%.
 */
export const DEFENSE_CONSTANT = 120;
