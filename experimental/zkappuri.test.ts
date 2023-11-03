import { describe, expect, it } from "@jest/globals";
import {
  Field,
  SmartContract,
  method,
  VerificationKey,
  Types,
  DeployArgs,
  Permissions,
} from "o1js";

jest.setTimeout(1000 * 60 * 60); // 1 hour

describe("Compile a contract", () => {
  it("should compile a contract VK", async () => {
    class VK extends SmartContract {
      deploy(args: DeployArgs) {
        super.deploy(args);
        this.account.permissions.set({
          ...Permissions.default(),
          setDelegate: Permissions.proof(),
          setPermissions: Permissions.proof(),
          setVerificationKey: Permissions.proof(),
          setZkappUri: Permissions.proof(),
          setTokenSymbol: Permissions.proof(),
          incrementNonce: Permissions.proof(),
          setVotingFor: Permissions.proof(),
          setTiming: Permissions.proof(),
        });
        this.emitEvent("mint", Field(0));
      }

      @method setVK(key: VerificationKey) {
        this.account.verificationKey.set(key);
      }
    }
    console.time("compiled");
    console.log("Compiling VK");
    await VK.compile();
    console.timeEnd("compiled");
  });

  it("should compile a contract URI", async () => {
    class URI extends SmartContract {
      deploy(args: DeployArgs) {
        super.deploy(args);
        this.account.permissions.set({
          ...Permissions.default(),
          setDelegate: Permissions.proof(),
          setPermissions: Permissions.proof(),
          setVerificationKey: Permissions.proof(),
          setZkappUri: Permissions.proof(),
          setTokenSymbol: Permissions.proof(),
          incrementNonce: Permissions.proof(),
          setVotingFor: Permissions.proof(),
          setTiming: Permissions.proof(),
        });
        this.emitEvent("mint", Field(0));
      }

      @method setURI(uri: Types.ZkappUri) {
        this.account.zkappUri.set(uri.data);
      }
    }
    console.time("compiled");
    console.log("Compiling URI");
    await URI.compile();
    console.timeEnd("compiled");
  });
});
