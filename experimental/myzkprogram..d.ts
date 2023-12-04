import { SmartContract } from "o1js";
export default function TreeFunction(height: number): {
    TreeCalculation: {
        name: string;
        compile: (options?: {
            cache: import("o1js/dist/node/lib/proof-system/cache").Cache;
        } | undefined) => Promise<{
            verificationKey: string;
        }>;
        verify: (proof: import("o1js/dist/node/lib/proof_system").Proof<import("o1js/dist/node/lib/field").Field, void>) => Promise<boolean>;
        digest: () => string;
        analyzeMethods: () => {
            check: {
                rows: number;
                digest: string;
                result: unknown;
                gates: import("o1js/dist/node/snarky").Gate[];
                publicInputSize: number;
            };
        };
        publicInputType: typeof import("o1js/dist/node/lib/field").Field & ((x: string | number | bigint | import("o1js/dist/node/lib/field").Field | import("o1js/dist/node/lib/field").FieldVar | import("o1js/dist/node/lib/field").FieldConst) => import("o1js/dist/node/lib/field").Field);
        publicOutputType: import("o1js/dist/node/lib/circuit_value").ProvablePureExtended<void, null>;
        privateInputTypes: {
            check: [{
                new (witness: import("o1js/dist/node/lib/merkle_tree").Witness): {
                    path: import("o1js/dist/node/lib/field").Field[];
                    isLeft: import("o1js/dist/node/lib/bool").Bool[];
                    height(): number;
                    calculateRoot(leaf: import("o1js/dist/node/lib/field").Field): import("o1js/dist/node/lib/field").Field;
                    calculateRootSlow(leaf: import("o1js/dist/node/lib/field").Field): import("o1js/dist/node/lib/field").Field;
                    calculateIndex(): import("o1js/dist/node/lib/field").Field;
                    toFields(): import("o1js/dist/node/lib/field").Field[];
                    toJSON(): any;
                    toConstant(): any;
                    equals(x: any): import("o1js/dist/node/lib/bool").Bool;
                    assertEquals(x: any): void;
                    isConstant(): boolean;
                };
                height: number;
                fromObject<T extends import("o1js/dist/node/lib/circuit_value").AnyConstructor>(this: T, value: import("o1js/dist/node/bindings/lib/provable-snarky").NonMethods<InstanceType<T>>): InstanceType<T>;
                sizeInFields(): number;
                toFields<T_1 extends import("o1js/dist/node/lib/circuit_value").AnyConstructor>(this: T_1, v: InstanceType<T_1>): import("o1js/dist/node/lib/field").Field[];
                toAuxiliary(): [];
                toInput<T_2 extends import("o1js/dist/node/lib/circuit_value").AnyConstructor>(this: T_2, v: InstanceType<T_2>): import("o1js/dist/node/bindings/lib/provable-snarky").HashInput;
                fromFields<T_3 extends import("o1js/dist/node/lib/circuit_value").AnyConstructor>(this: T_3, xs: import("o1js/dist/node/lib/field").Field[]): InstanceType<T_3>;
                check<T_4 extends import("o1js/dist/node/lib/circuit_value").AnyConstructor>(this: T_4, v: InstanceType<T_4>): void;
                toConstant<T_5 extends import("o1js/dist/node/lib/circuit_value").AnyConstructor>(this: T_5, t: InstanceType<T_5>): InstanceType<T_5>;
                toJSON<T_6 extends import("o1js/dist/node/lib/circuit_value").AnyConstructor>(this: T_6, v: InstanceType<T_6>): any;
                fromJSON<T_7 extends import("o1js/dist/node/lib/circuit_value").AnyConstructor>(this: T_7, value: any): InstanceType<T_7>;
            }, typeof import("o1js/dist/node/lib/field").Field & ((x: string | number | bigint | import("o1js/dist/node/lib/field").Field | import("o1js/dist/node/lib/field").FieldVar | import("o1js/dist/node/lib/field").FieldConst) => import("o1js/dist/node/lib/field").Field)];
        };
        rawMethods: {
            check: (publicInput: import("o1js/dist/node/lib/field").Field, ...args: [{
                path: import("o1js/dist/node/lib/field").Field[];
                isLeft: import("o1js/dist/node/lib/bool").Bool[];
                height(): number;
                calculateRoot(leaf: import("o1js/dist/node/lib/field").Field): import("o1js/dist/node/lib/field").Field;
                calculateRootSlow(leaf: import("o1js/dist/node/lib/field").Field): import("o1js/dist/node/lib/field").Field;
                calculateIndex(): import("o1js/dist/node/lib/field").Field;
                toFields(): import("o1js/dist/node/lib/field").Field[];
                toJSON(): any;
                toConstant(): any;
                equals(x: any): import("o1js/dist/node/lib/bool").Bool;
                assertEquals(x: any): void;
                isConstant(): boolean;
            }, import("o1js/dist/node/lib/field").Field] & any[]) => void;
        };
    } & {
        check: (publicInput: import("o1js/dist/node/lib/field").Field, ...args: [{
            path: import("o1js/dist/node/lib/field").Field[];
            isLeft: import("o1js/dist/node/lib/bool").Bool[];
            height(): number;
            calculateRoot(leaf: import("o1js/dist/node/lib/field").Field): import("o1js/dist/node/lib/field").Field;
            calculateRootSlow(leaf: import("o1js/dist/node/lib/field").Field): import("o1js/dist/node/lib/field").Field;
            calculateIndex(): import("o1js/dist/node/lib/field").Field;
            toFields(): import("o1js/dist/node/lib/field").Field[];
            toJSON(): any;
            toConstant(): any;
            equals(x: any): import("o1js/dist/node/lib/bool").Bool;
            assertEquals(x: any): void;
            isConstant(): boolean;
        }, import("o1js/dist/node/lib/field").Field] & any[]) => Promise<import("o1js/dist/node/lib/proof_system").Proof<import("o1js/dist/node/lib/field").Field, void>>;
    };
    TreeVerifier: {
        new (address: import("o1js/dist/node/lib/signature").PublicKey, tokenId?: import("o1js/dist/node/lib/field").Field | undefined): {
            verifyRedactedTree(proof: {
                publicInput: import("o1js/dist/node/lib/field").Field;
                publicOutput: void;
                proof: unknown;
                maxProofsVerified: 0 | 2 | 1;
                shouldVerify: import("o1js/dist/node/lib/bool").Bool;
                verify(): void;
                verifyIf(condition: import("o1js/dist/node/lib/bool").Bool): void;
                toJSON(): import("o1js/dist/node/lib/proof_system").JsonProof;
            }): void;
            "__#5@#private": any;
            address: import("o1js/dist/node/lib/signature").PublicKey;
            tokenId: import("o1js/dist/node/lib/field").Field;
            deploy({ verificationKey, zkappKey, }?: {
                verificationKey?: {
                    data: string;
                    hash: string | import("o1js/dist/node/lib/field").Field;
                } | undefined;
                zkappKey?: import("o1js/dist/node/lib/signature").PrivateKey | undefined;
            } | undefined): void;
            init(): void;
            requireSignature(): void;
            sign(zkappKey?: import("o1js/dist/node/lib/signature").PrivateKey | undefined): void;
            skipAuthorization(): void;
            readonly self: import("o1js/dist/node/lib/account_update").AccountUpdate;
            newSelf(): import("o1js/dist/node/lib/account_update").AccountUpdate;
            readonly sender: import("o1js/dist/node/lib/signature").PublicKey;
            readonly account: import("o1js/dist/node/lib/precondition").Account;
            readonly network: import("o1js/dist/node/lib/precondition").Network;
            readonly currentSlot: import("o1js/dist/node/lib/precondition").CurrentSlot;
            readonly token: {
                id: import("o1js/dist/node/lib/field").Field;
                parentTokenId: import("o1js/dist/node/lib/field").Field;
                tokenOwner: import("o1js/dist/node/lib/signature").PublicKey;
                mint({ address, amount, }: {
                    address: import("o1js/dist/node/lib/signature").PublicKey | SmartContract | import("o1js/dist/node/lib/account_update").AccountUpdate;
                    amount: number | bigint | import("o1js/dist/node/lib/int").UInt64;
                }): import("o1js/dist/node/lib/account_update").AccountUpdate;
                burn({ address, amount, }: {
                    address: import("o1js/dist/node/lib/signature").PublicKey | SmartContract | import("o1js/dist/node/lib/account_update").AccountUpdate;
                    amount: number | bigint | import("o1js/dist/node/lib/int").UInt64;
                }): import("o1js/dist/node/lib/account_update").AccountUpdate;
                send({ from, to, amount, }: {
                    from: import("o1js/dist/node/lib/signature").PublicKey | SmartContract | import("o1js/dist/node/lib/account_update").AccountUpdate;
                    to: import("o1js/dist/node/lib/signature").PublicKey | SmartContract | import("o1js/dist/node/lib/account_update").AccountUpdate;
                    amount: number | bigint | import("o1js/dist/node/lib/int").UInt64;
                }): import("o1js/dist/node/lib/account_update").AccountUpdate;
            };
            approve(updateOrCallback: import("o1js/dist/node/lib/account_update").AccountUpdate | import("o1js/dist/node/lib/zkapp").Callback<any>, layout?: import("o1js/dist/node/lib/account_update").AccountUpdatesLayout | undefined): import("o1js/dist/node/lib/account_update").AccountUpdate;
            send(args: {
                to: import("o1js/dist/node/lib/signature").PublicKey | SmartContract | import("o1js/dist/node/lib/account_update").AccountUpdate;
                amount: number | bigint | import("o1js/dist/node/lib/int").UInt64;
            }): import("o1js/dist/node/lib/account_update").AccountUpdate;
            readonly tokenSymbol: {
                set(tokenSymbol: string): void;
            };
            readonly balance: {
                addInPlace(x: string | number | bigint | import("o1js/dist/node/lib/int").UInt64 | import("o1js/dist/node/lib/int").UInt32 | import("o1js/dist/node/lib/int").Int64): void;
                subInPlace(x: string | number | bigint | import("o1js/dist/node/lib/int").UInt64 | import("o1js/dist/node/lib/int").UInt32 | import("o1js/dist/node/lib/int").Int64): void;
            };
            events: {
                [key: string]: import("o1js/dist/node/lib/circuit_value").FlexibleProvablePure<any>;
            };
            emitEvent<K extends string | number>(type: K, event: any): void;
            fetchEvents(start?: import("o1js/dist/node/lib/int").UInt32 | undefined, end?: import("o1js/dist/node/lib/int").UInt32 | undefined): Promise<{
                type: string;
                event: {
                    data: import("o1js/dist/node/snarky").ProvablePure<any>;
                    transactionInfo: {
                        transactionHash: string;
                        transactionStatus: string;
                        transactionMemo: string;
                    };
                };
                blockHeight: import("o1js/dist/node/lib/int").UInt32;
                blockHash: string;
                parentBlockHash: string;
                globalSlot: import("o1js/dist/node/lib/int").UInt32;
                chainStatus: string;
            }[]>;
            setValue<T_8>(maybeValue: import("o1js/dist/node/lib/account_update").SetOrKeep<T_8>, value: T_8): void;
            setPermissions(permissions: import("o1js/dist/node/lib/account_update").Permissions): void;
        };
        _methods?: import("o1js/dist/node/lib/proof_system").MethodInterface[] | undefined;
        _methodMetadata?: Record<string, {
            actions: number;
            rows: number;
            digest: string;
            hasReturn: boolean;
            gates: import("o1js/dist/node/snarky").Gate[];
        }> | undefined;
        _provers?: import("o1js/dist/node/snarky").Pickles.Prover[] | undefined;
        _maxProofsVerified?: 0 | 2 | 1 | undefined;
        _verificationKey?: {
            data: string;
            hash: import("o1js/dist/node/lib/field").Field;
        } | undefined;
        Proof(): {
            new ({ proof, publicInput, publicOutput, maxProofsVerified, }: {
                proof: unknown;
                publicInput: import("o1js/dist/node/lib/account_update").ZkappPublicInput;
                publicOutput: undefined;
                maxProofsVerified: 0 | 2 | 1;
            }): {
                publicInput: import("o1js/dist/node/lib/account_update").ZkappPublicInput;
                publicOutput: undefined;
                proof: unknown;
                maxProofsVerified: 0 | 2 | 1;
                shouldVerify: import("o1js/dist/node/lib/bool").Bool;
                verify(): void;
                verifyIf(condition: import("o1js/dist/node/lib/bool").Bool): void;
                toJSON(): import("o1js/dist/node/lib/proof_system").JsonProof;
            };
            publicInputType: import("o1js/dist/node/snarky").ProvablePure<{
                accountUpdate: import("o1js/dist/node/lib/field").Field;
                calls: import("o1js/dist/node/lib/field").Field;
            }> & {
                toInput: (x: {
                    accountUpdate: import("o1js/dist/node/lib/field").Field;
                    calls: import("o1js/dist/node/lib/field").Field;
                }) => {
                    fields?: import("o1js/dist/node/lib/field").Field[] | undefined;
                    packed?: [import("o1js/dist/node/lib/field").Field, number][] | undefined;
                };
                toJSON: (x: {
                    accountUpdate: import("o1js/dist/node/lib/field").Field;
                    calls: import("o1js/dist/node/lib/field").Field;
                }) => {
                    accountUpdate: string;
                    calls: string;
                };
                fromJSON: (x: {
                    accountUpdate: string;
                    calls: string;
                }) => {
                    accountUpdate: import("o1js/dist/node/lib/field").Field;
                    calls: import("o1js/dist/node/lib/field").Field;
                };
            };
            publicOutputType: import("o1js/dist/node/lib/circuit_value").ProvablePureExtended<undefined, null>;
            tag: () => typeof SmartContract;
            fromJSON<S extends (new (...args: any) => import("o1js/dist/node/lib/proof_system").Proof<unknown, unknown>) & {
                prototype: import("o1js/dist/node/lib/proof_system").Proof<any, any>;
                publicInputType: import("o1js/dist/node/lib/circuit_value").FlexibleProvablePure<any>;
                publicOutputType: import("o1js/dist/node/lib/circuit_value").FlexibleProvablePure<any>;
                tag: () => {
                    name: string;
                };
                fromJSON: typeof import("o1js/dist/node/lib/proof_system").Proof.fromJSON;
                dummy: typeof import("o1js/dist/node/lib/proof_system").Proof.dummy;
            } & {
                prototype: import("o1js/dist/node/lib/proof_system").Proof<unknown, unknown>;
            }>(this: S, { maxProofsVerified, proof: proofString, publicInput: publicInputJson, publicOutput: publicOutputJson, }: import("o1js/dist/node/lib/proof_system").JsonProof): import("o1js/dist/node/lib/proof_system").Proof<import("o1js/dist/node/bindings/lib/provable-snarky").InferProvable<S["publicInputType"]>, import("o1js/dist/node/bindings/lib/provable-snarky").InferProvable<S["publicOutputType"]>>;
            dummy<Input, OutPut>(publicInput: Input, publicOutput: OutPut, maxProofsVerified: 0 | 2 | 1, domainLog2?: number | undefined): Promise<import("o1js/dist/node/lib/proof_system").Proof<Input, OutPut>>;
        };
        compile({ cache }?: {
            cache?: import("o1js/dist/node/lib/proof-system/cache").Cache | undefined;
        } | undefined): Promise<{
            verificationKey: {
                data: string;
                hash: import("o1js/dist/node/lib/field").Field;
            };
            provers: import("o1js/dist/node/snarky").Pickles.Prover[];
            verify: (statement: import("o1js/dist/node/snarky").Pickles.Statement<import("o1js/dist/node/lib/field").FieldConst>, proof: unknown) => Promise<boolean>;
        }>;
        digest(): string;
        runOutsideCircuit(run: () => void): void;
        analyzeMethods(): Record<string, {
            actions: number;
            rows: number;
            digest: string;
            hasReturn: boolean;
            gates: import("o1js/dist/node/snarky").Gate[];
        }>;
    };
};
