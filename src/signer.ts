import { defineReadOnly } from "@ethersproject/properties";
import { ethers } from "ethers";
import { ZeroWalletProvider } from "./provider";
import { Logger } from "@ethersproject/logger";

const version = "providers/5.7.2";
const logger = new Logger(version);
const _constructorGuard = {};

export class ZeroWalletSigner extends ethers.providers.JsonRpcSigner {
    constructor(constructorGuard: any, provider: ZeroWalletProvider, addressOrIndex?: string | number) {
        
        super(constructorGuard, provider, addressOrIndex);
        
        if (constructorGuard !== _constructorGuard) {
            throw new Error("do not call the JsonRpcSigner constructor directly; use provider.getSigner");
        }

        defineReadOnly(this, "provider", provider);

        if (addressOrIndex == null) { addressOrIndex = 0; }

        if (typeof(addressOrIndex) === "string") {
            defineReadOnly(this, "_address", this.provider.formatter.address(addressOrIndex));
            defineReadOnly(this, "_index", null);

        } else if (typeof(addressOrIndex) === "number") {
            defineReadOnly(this, "_index", addressOrIndex);
            defineReadOnly(this, "_address", null);

        } else {
            logger.throwArgumentError("invalid address or index", "addressOrIndex", addressOrIndex);
        }
    }

    getProvider() {
        return this.provider;
    }
}