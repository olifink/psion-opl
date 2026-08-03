import { OplError, OplErrorCode } from "@psion-opl/opl-shared";
import type { OplHost } from "./capabilities.js";

/** §12 Capability Discovery — missing optional capabilities raise CAPABILITY_MISSING. */
export function requireCapability<K extends keyof OplHost>(
  host: OplHost,
  capability: K,
): NonNullable<OplHost[K]> {
  const value = host[capability];
  if (!value) {
    throw new OplError(OplErrorCode.CAPABILITY_MISSING, `Host capability "${capability}" is not available`);
  }
  return value as NonNullable<OplHost[K]>;
}
