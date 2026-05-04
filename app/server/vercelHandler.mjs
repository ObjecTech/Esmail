import { handleApi } from "./index.mjs";
import { withTokenStoreContext } from "./tokenStore.mjs";

export default function handler(req, res) {
  return withTokenStoreContext(req, res, () => handleApi(req, res));
}
