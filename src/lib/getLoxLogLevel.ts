import { ORDERED_LOG_LEVELS } from "../common/constants";
import { LOG_LEVEL } from "../common/types/base";

export function getLoxLogLevel() {
  const { LOX_LOG_LEVEL } = process.env;
  
  if (!LOX_LOG_LEVEL) {
    return "info";
  }

  if ((ORDERED_LOG_LEVELS as string[]).includes(LOX_LOG_LEVEL)) {
    return LOX_LOG_LEVEL as LOG_LEVEL;
  }

  return "info";
}