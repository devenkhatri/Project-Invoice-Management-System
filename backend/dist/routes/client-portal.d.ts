import { Client } from '../models/Client';
declare const router: import("express-serve-static-core").Router;
declare global {
    namespace Express {
        interface Request {
            client?: Client;
        }
    }
}
export default router;
//# sourceMappingURL=client-portal.d.ts.map