export interface AppConfig {
    server: {
        port: number;
        nodeEnv: string;
        frontendUrl: string;
    };
    googleSheets: {
        spreadsheetId: string;
        serviceAccountEmail: string;
        privateKey: string;
    };
    jwt: {
        secret: string;
        refreshSecret: string;
        expiresIn: string;
        refreshExpiresIn: string;
    };
    paymentGateways: {
        stripe: {
            secretKey: string;
            publishableKey: string;
        };
        paypal: {
            clientId: string;
            clientSecret: string;
        };
        razorpay: {
            keyId: string;
            keySecret: string;
        };
    };
    email: {
        service: string;
        user: string;
        pass: string;
    };
    gst: {
        apiBaseUrl: string;
        apiKey: string;
    };
}
declare const config: AppConfig;
export declare function validateConfig(): {
    isValid: boolean;
    missingVars: string[];
};
export default config;
//# sourceMappingURL=index.d.ts.map