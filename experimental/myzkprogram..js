"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const o1js_1 = require("o1js");
function TreeFunction(height) {
    class MerkleTreeWitness extends (0, o1js_1.MerkleWitness)(height) {
    }
    const TreeCalculation = (0, o1js_1.ZkProgram)({
        name: "TreeCalculation",
        publicInput: o1js_1.Field,
        methods: {
            check: {
                privateInputs: [MerkleTreeWitness, o1js_1.Field],
                method(root, witness, value) {
                    const calculatedRoot = witness.calculateRoot(value);
                    calculatedRoot.assertEquals(root);
                },
            },
        },
    });
    class TreeProof extends o1js_1.ZkProgram.Proof(TreeCalculation) {
    }
    class TreeVerifier extends o1js_1.SmartContract {
        verifyRedactedTree(proof) {
            proof.verify();
        }
    }
    __decorate([
        o1js_1.method,
        __metadata("design:type", Function),
        __metadata("design:paramtypes", [TreeProof]),
        __metadata("design:returntype", void 0)
    ], TreeVerifier.prototype, "verifyRedactedTree", null);
    return { TreeCalculation, TreeVerifier };
}
exports.default = TreeFunction;
