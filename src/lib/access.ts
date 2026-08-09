import { cookies } from "next/headers";
import { ENTITLEMENT_COOKIE, verifyEntitlement, type PlanId } from "./billing";

/** The caller's plan, read from the signed entitlement cookie. */
export async function currentPlan(): Promise<PlanId> {
  const jar = await cookies();
  return verifyEntitlement(jar.get(ENTITLEMENT_COOKIE)?.value);
}

export async function hasPaidAccess(): Promise<boolean> {
  const plan = await currentPlan();
  return plan === "candidate" || plan === "employer";
}
