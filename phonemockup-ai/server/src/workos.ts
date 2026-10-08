import {WorkOS} from "@workos-inc/node";
import {config} from "./config";

export default new WorkOS(config.workosApiKey, {
    clientId: config.workosClientId,
});